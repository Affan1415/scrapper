import re
import json
import html as html_module
from typing import Optional
from urllib.parse import urljoin, urlparse
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
from bs4 import BeautifulSoup

EMAIL_REGEX = re.compile(
    r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}',
    re.IGNORECASE
)

EXCLUDED_EMAIL_PATTERNS = [
    "noreply", "no-reply", "donotreply", "example", "test@",
    "@sentry", "@example.com", "@domain.com", "@email.com",
    "your@", "user@", "name@", "info@wix", "@w3.org",
    "@2x", "@3x", "schema.org", "wixpress", "squarespace",
    "@google", "@googletagmanager", "@facebook", "@instagram",
    "@apple.com", "@microsoft.com", "@adobe.com",
    "email@", "@company.com", "support@example",
]

# Hardcoded contact paths to try when auto-discovery finds nothing
CONTACT_PATHS = [
    "/contact", "/contact-us", "/about", "/about-us",
    "/get-in-touch", "/team", "/our-team", "/staff",
    "/appointment", "/schedule", "/book", "/book-online",
    "/location", "/locations", "/office", "/reach-us",
]

# Keywords that suggest a link leads to a contact/team page
CONTACT_LINK_KEYWORDS = [
    "contact", "reach us", "email", "get in touch",
    "appointment", "schedule", "book", "connect",
    "enquiry", "inquiry", "find us", "team", "staff",
]


def _is_valid_email(email: str) -> bool:
    el = email.lower()
    return (
        not any(p in el for p in EXCLUDED_EMAIL_PATTERNS)
        and len(email) < 100
        and "." in el.split("@")[-1]
    )


def _extract_emails_from_text(text: str) -> list[str]:
    return [e for e in EMAIL_REGEX.findall(text) if _is_valid_email(e)]


def _decode_obfuscated(text: str) -> str:
    """Replace common anti-spam obfuscation so the email regex can find them."""
    text = re.sub(r'\s*\[at\]\s*', '@', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*\(at\)\s*', '@', text, flags=re.IGNORECASE)
    text = re.sub(r'\s+at\s+', '@', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*\[dot\]\s*', '.', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*\(dot\)\s*', '.', text, flags=re.IGNORECASE)
    return text


def _extract_from_json_ld(data) -> list[str]:
    """Recursively find email fields inside JSON-LD structured data."""
    emails = []
    if isinstance(data, dict):
        for key, value in data.items():
            if key.lower() == "email" and isinstance(value, str):
                if _is_valid_email(value):
                    emails.append(value)
            else:
                emails.extend(_extract_from_json_ld(value))
    elif isinstance(data, list):
        for item in data:
            emails.extend(_extract_from_json_ld(item))
    return emails


def _extract_emails_from_html(html: str) -> list[str]:
    """
    Multi-strategy extraction in priority order:
    1. mailto: href attributes — most reliable, no false positives
    2. JSON-LD schema.org structured data — many business sites embed this
    3. Footer element — #1 place businesses put contact info
    4. Inline <script> tags — emails sometimes stored in JS config variables
    5. Full page text with obfuscation decoding — catch-all
    6. HTML entity decoded source — catches &#64; / &commat; encoded emails
    """
    found = []
    soup = BeautifulSoup(html, "html.parser")

    # 1. mailto: links
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.lower().startswith("mailto:"):
            email = href[7:].split("?")[0].strip()
            if email and _is_valid_email(email):
                found.append(email)

    # 2. JSON-LD structured data
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            found.extend(_extract_from_json_ld(data))
        except (json.JSONDecodeError, TypeError, ValueError):
            pass

    # 3. Footer — high-signal zone, checked before full-page scan
    footer = soup.find("footer")
    if footer:
        footer_text = _decode_obfuscated(footer.get_text(" "))
        found.extend(_extract_emails_from_text(footer_text))

    # 4. Inline script tags — email sometimes in JS config/init objects
    for script in soup.find_all("script"):
        if script.string and "@" in script.string:
            found.extend(_extract_emails_from_text(script.string))

    # 5. Full page fallback with obfuscation decoding
    page_text = _decode_obfuscated(soup.get_text(" "))
    found.extend(_extract_emails_from_text(page_text))

    # 6. HTML entity decoding — catches &#64; and &commat; encoded emails
    decoded_html = html_module.unescape(html)
    if decoded_html != html:
        found.extend(_extract_emails_from_text(decoded_html))

    # Deduplicate preserving priority order
    seen: set[str] = set()
    result = []
    for e in found:
        el = e.lower()
        if el not in seen:
            seen.add(el)
            result.append(e)
    return result


def _discover_contact_links(html: str, base_url: str) -> list[str]:
    """
    Crawl homepage links to find contact/team pages by anchor text and URL path.
    Returns up to 3 same-domain URLs most likely to have an email.
    """
    soup = BeautifulSoup(html, "html.parser")
    base_domain = urlparse(base_url).netloc
    links: list[str] = []

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue

        abs_url = urljoin(base_url, href).split("?")[0].split("#")[0]
        parsed = urlparse(abs_url)

        if parsed.netloc and parsed.netloc != base_domain:
            continue

        text = (a.get_text() or "").lower().strip()
        path_lower = parsed.path.lower()

        is_contact = any(kw in text for kw in CONTACT_LINK_KEYWORDS) or any(
            kw in path_lower
            for kw in ["contact", "reach", "appointment", "schedule", "book", "team", "staff", "about"]
        )

        if is_contact and abs_url not in links:
            links.append(abs_url)

    return links[:3]


async def _load_and_extract(page, url: str, timeout_ms: int) -> list[str]:
    """
    Load a URL, wait for JS to settle, extract emails.
    Uses domcontentloaded + short networkidle wait to catch SPA-rendered content.
    """
    try:
        await page.goto(url, timeout=timeout_ms, wait_until="domcontentloaded")
        try:
            await page.wait_for_load_state("networkidle", timeout=3000)
        except PlaywrightTimeout:
            pass
        html = await page.content()
        return _extract_emails_from_html(html)
    except PlaywrightTimeout:
        try:
            html = await page.content()
            return _extract_emails_from_html(html)
        except Exception:
            return []
    except Exception:
        return []


async def scrape_email_from_website(url: str, timeout_ms: int = 10000) -> Optional[str]:
    """
    Visit a business website and extract the best email found.

    Strategy:
    1. Load homepage — check mailto links, JSON-LD, footer, full text
    2. Auto-discover contact links by crawling homepage anchors
    3. Fall back to hardcoded contact paths (/contact, /about, etc.)

    Stops and returns as soon as any email is found.
    """
    if not url:
        return None
    if not url.startswith("http"):
        url = "https://" + url

    # Strip tracking params, work from clean root URL
    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
        )
        page = await context.new_page()

        try:
            # Step 1: Homepage — load once, extract + discover links
            homepage_html = ""
            try:
                await page.goto(base, timeout=timeout_ms, wait_until="domcontentloaded")
                try:
                    await page.wait_for_load_state("networkidle", timeout=3000)
                except PlaywrightTimeout:
                    pass
                homepage_html = await page.content()
            except Exception:
                pass

            if homepage_html:
                emails = _extract_emails_from_html(homepage_html)
                if emails:
                    return emails[0]

            # Step 2: Auto-discovered contact links from homepage anchors
            discovered = _discover_contact_links(homepage_html, base) if homepage_html else []
            for link_url in discovered:
                emails = await _load_and_extract(page, link_url, timeout_ms)
                if emails:
                    return emails[0]

            # Step 3: Hardcoded contact paths not already visited
            visited = {base} | set(discovered)
            for path in CONTACT_PATHS:
                candidate = base + path
                if candidate in visited:
                    continue
                visited.add(candidate)
                emails = await _load_and_extract(page, candidate, timeout_ms)
                if emails:
                    return emails[0]

        finally:
            await browser.close()

    return None
