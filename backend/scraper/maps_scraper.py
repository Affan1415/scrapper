import re
import asyncio
from typing import Optional, Callable
from dataclasses import dataclass
from playwright.async_api import async_playwright, Page, TimeoutError as PlaywrightTimeout


@dataclass
class BusinessData:
    business_name: str
    category: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    google_maps_url: Optional[str] = None


def _parse_review_count(text: str) -> Optional[int]:
    # Extract number from parentheses: "4.9\n(848)" → 848
    m = re.search(r"\(([0-9,]+)\)", text)
    if m:
        return int(m.group(1).replace(",", ""))
    # Fallback: strip all non-digits (only if no decimal point present)
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else None


def _parse_rating(text: str) -> Optional[float]:
    match = re.search(r"(\d+\.?\d*)", text)
    return float(match.group(1)) if match else None


def _parse_lat_lng(url: str) -> tuple[Optional[float], Optional[float]]:
    m = re.search(r"@(-?\d+\.\d+),(-?\d+\.\d+)", url)
    if m:
        return float(m.group(1)), float(m.group(2))
    return None, None


async def _extract_business_from_panel(page: Page, card_url: Optional[str] = None) -> Optional[BusinessData]:
    """
    Extract structured data from the open business detail panel.
    Uses selectors verified against live Google Maps DOM (June 2026).
    """
    # Name — .DUwDvf is the current panel heading class
    try:
        name_el = page.locator(".DUwDvf").first
        name = await name_el.inner_text(timeout=4000)
        if not name or not name.strip():
            return None
    except Exception:
        return None

    data = BusinessData(business_name=name.strip())

    # Category — .DkEaL is the category button
    try:
        cat_el = page.locator(".DkEaL").first
        data.category = (await cat_el.inner_text(timeout=2000)).strip()
    except Exception:
        pass

    # Rating — .MW4etd contains just the number e.g. "4.9"
    try:
        rating_el = page.locator(".MW4etd").first
        txt = await rating_el.inner_text(timeout=2000)
        data.rating = _parse_rating(txt)
    except Exception:
        pass

    # Review count — .dmRWX contains "4.9\n(848)"
    try:
        review_el = page.locator(".dmRWX").first
        txt = await review_el.inner_text(timeout=2000)
        data.review_count = _parse_review_count(txt)
    except Exception:
        pass

    # Phone — button with aria-label "Phone: +1 512-717-3147", or tel: link
    try:
        phone_btn = page.locator('button[aria-label*="Phone"]').first
        aria = await phone_btn.get_attribute("aria-label", timeout=2000)
        if aria:
            data.phone = aria.replace("Phone:", "").strip().rstrip()
    except Exception:
        pass
    if not data.phone:
        try:
            tel_link = page.locator('a[href^="tel:"]').first
            href = await tel_link.get_attribute("href", timeout=2000)
            if href:
                data.phone = href.replace("tel:", "").strip()
        except Exception:
            pass

    # Address — button with aria-label "Address: 1700 S 1st St..."
    try:
        addr_btn = page.locator('button[aria-label*="Address"]').first
        aria = await addr_btn.get_attribute("aria-label", timeout=2000)
        if aria:
            data.address = aria.replace("Address:", "").strip().rstrip()
    except Exception:
        pass

    # Website — anchor with aria-label "Website: ..."
    try:
        web_link = page.locator('a[aria-label*="Website"]').first
        href = await web_link.get_attribute("href", timeout=2000)
        data.website = href
    except Exception:
        pass

    # Lat/lng from current page URL (detail panel URL has @lat,lng)
    try:
        panel_url = page.url
        data.google_maps_url = panel_url
        data.latitude, data.longitude = _parse_lat_lng(panel_url)
        # If panel URL has no coords, fall back to card URL
        if data.latitude is None and card_url:
            data.latitude, data.longitude = _parse_lat_lng(card_url)
            data.google_maps_url = card_url
    except Exception:
        pass

    return data


async def scrape_google_maps(
    keyword: str,
    location: str,
    on_business_found: Callable[[BusinessData], None],
    max_results: int = 200,
) -> list[BusinessData]:
    """
    Scrape Google Maps for businesses matching keyword in location.
    Selectors verified against live Google Maps DOM (June 2026).
    Cards: .Nv2PK | Detail panel: .DUwDvf, .DkEaL, .MW4etd, .dmRWX
    Phone: button[aria-label*=Phone] | Address: button[aria-label*=Address]
    Website: a[aria-label*=Website]
    """
    results: list[BusinessData] = []
    search_query = f"{keyword} in {location}"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 900},
        )
        page = await context.new_page()

        encoded = search_query.replace(" ", "+")
        await page.goto(f"https://www.google.com/maps/search/{encoded}", timeout=30000)
        await page.wait_for_timeout(3000)

        results_panel = page.locator('[role="feed"]')
        previous_count = 0
        stale_rounds = 0

        while len(results) < max_results and stale_rounds < 5:
            # .Nv2PK is the current card container class
            cards = await page.locator(".Nv2PK").all()
            current_count = len(cards)

            if current_count == previous_count:
                stale_rounds += 1
                end_marker = page.locator("text=You've reached the end of the list")
                if await end_marker.count() > 0:
                    break
            else:
                stale_rounds = 0
                previous_count = current_count

            for card in cards[len(results):]:
                if len(results) >= max_results:
                    break
                try:
                    # Get the place URL before clicking (for lat/lng)
                    card_link = card.locator("a.hfpxzc").first
                    card_url = await card_link.get_attribute("href", timeout=1000)

                    await card.click(timeout=3000)
                    await page.wait_for_timeout(2500)

                    business = await _extract_business_from_panel(page, card_url)
                    if business:
                        results.append(business)
                        on_business_found(business)
                except Exception:
                    continue

            # Close any open detail panel before scrolling the results list
            try:
                await page.keyboard.press("Escape")
                await page.wait_for_timeout(400)
            except Exception:
                pass

            try:
                await results_panel.evaluate("el => el.scrollBy(0, 1200)")
            except PlaywrightTimeout:
                # Feed element not ready (detail panel still active) — fall back
                await page.evaluate(
                    "document.querySelector('[role=\"feed\"]')?.scrollBy(0, 1200)"
                )
            await page.wait_for_timeout(1200)

        await browser.close()

    return results
