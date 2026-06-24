import re
import asyncio
from typing import Optional
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout

# Email regex — harvested from FraneCal/google-maps-scraper
EMAIL_REGEX = re.compile(
    r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}',
    re.IGNORECASE
)

# False positives to exclude
EXCLUDED_EMAIL_PATTERNS = [
    "noreply", "no-reply", "donotreply", "example", "test@",
    "@sentry", "@example.com", "@domain.com", "@email.com",
    "your@", "user@", "name@", "info@wix", "@w3.org",
    "@2x", "@3x", "schema.org",
]

CONTACT_PATHS = ["/contact", "/contact-us", "/about", "/about-us", "/reach-us"]


def _is_valid_email(email: str) -> bool:
    email_lower = email.lower()
    return not any(pattern in email_lower for pattern in EXCLUDED_EMAIL_PATTERNS)


def _extract_emails_from_text(text: str) -> list[str]:
    found = EMAIL_REGEX.findall(text)
    return [e for e in found if _is_valid_email(e)]


async def scrape_email_from_website(url: str, timeout_ms: int = 8000) -> Optional[str]:
    """
    Visit a business website and extract the first valid email.
    Checks homepage, then /contact and /about pages.
    Harvested pattern from: FraneCal/google-maps-scraper
    """
    if not url:
        return None
    if not url.startswith("http"):
        url = "https://" + url

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        )
        page = await context.new_page()
        base = url.rstrip("/")
        pages_to_check = [base] + [base + path for path in CONTACT_PATHS]

        try:
            for page_url in pages_to_check:
                try:
                    await page.goto(page_url, timeout=timeout_ms, wait_until="domcontentloaded")
                    content = await page.content()
                    emails = _extract_emails_from_text(content)
                    if emails:
                        return emails[0]
                except PlaywrightTimeout:
                    continue
                except Exception:
                    continue
        finally:
            await browser.close()

    return None
