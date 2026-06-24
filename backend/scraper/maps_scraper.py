import re
import asyncio
from typing import Optional, Callable
from dataclasses import dataclass, field
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
    """Parse '(1,234)' or '1,234 reviews' to int."""
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else None


def _parse_rating(text: str) -> Optional[float]:
    match = re.search(r"(\d+\.?\d*)", text)
    return float(match.group(1)) if match else None


async def _extract_business_from_panel(page: Page) -> Optional[BusinessData]:
    """
    Extract structured data from the open business detail panel.
    Patterns harvested from omkarcloud/google-maps-scraper.
    """
    try:
        name_el = page.locator('h1').first
        name = await name_el.inner_text(timeout=3000)
    except Exception:
        return None

    data = BusinessData(business_name=name.strip())

    # Category
    try:
        category_el = page.locator('button[jsaction*="category"]').first
        data.category = (await category_el.inner_text(timeout=2000)).strip()
    except Exception:
        pass

    # Rating from aria-label (e.g. "4.5 stars")
    try:
        rating_el = page.locator('[aria-label*="stars"]').first
        aria = await rating_el.get_attribute("aria-label", timeout=2000)
        if aria:
            data.rating = _parse_rating(aria)
    except Exception:
        pass

    # Review count from aria-label (e.g. "1,234 reviews")
    try:
        review_el = page.locator('[aria-label*="reviews"]').first
        aria = await review_el.get_attribute("aria-label", timeout=2000)
        if aria:
            data.review_count = _parse_review_count(aria)
    except Exception:
        pass

    # Address, phone, website from data-item-id buttons
    try:
        buttons = await page.locator('[data-item-id]').all()
        for btn in buttons[:20]:  # cap at 20 to avoid slow loops
            try:
                item_id = await btn.get_attribute("data-item-id", timeout=500)
                text = await btn.inner_text(timeout=500)
                if not item_id or not text:
                    continue
                item_id_lower = item_id.lower()
                if "address" in item_id_lower:
                    data.address = text.strip()
                elif "phone" in item_id_lower:
                    data.phone = text.strip()
                elif "authority" in item_id_lower:
                    data.website = text.strip()
            except Exception:
                continue
    except Exception:
        pass

    # Lat/lng from URL
    try:
        current_url = page.url
        data.google_maps_url = current_url
        lat_lng = re.search(r"@(-?\d+\.\d+),(-?\d+\.\d+)", current_url)
        if lat_lng:
            data.latitude = float(lat_lng.group(1))
            data.longitude = float(lat_lng.group(2))
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
    Calls on_business_found callback for each business as it is found.
    Patterns harvested from: omkarcloud/google-maps-scraper, gosom/google-maps-scraper
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
        await page.wait_for_timeout(2000)

        results_panel = page.locator('[role="feed"]')
        previous_count = 0
        stale_rounds = 0

        while len(results) < max_results and stale_rounds < 5:
            cards = await page.locator('[role="feed"] > div[jsaction]').all()
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
                    await card.click(timeout=3000)
                    await page.wait_for_timeout(1500)
                    business = await _extract_business_from_panel(page)
                    if business:
                        results.append(business)
                        on_business_found(business)
                except Exception:
                    continue

            await results_panel.evaluate("el => el.scrollBy(0, 1000)")
            await page.wait_for_timeout(1000)

        await browser.close()

    return results
