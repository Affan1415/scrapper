import asyncio
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from ..models import SearchJob, Lead, JobStatus, BusinessSize, _size_tier
from ..schemas import FiltersSchema
from .maps_scraper import scrape_google_maps, BusinessData
from .email_scraper import scrape_email_from_website


def _passes_filters(business: BusinessData, filters: FiltersSchema) -> bool:
    if filters.min_rating is not None and (business.rating or 0) < filters.min_rating:
        return False
    if filters.max_rating is not None and (business.rating or 5.0) > filters.max_rating:
        return False
    if filters.has_website and not business.website:
        return False
    if filters.has_phone and not business.phone:
        return False
    if filters.min_reviews is not None and (business.review_count or 0) < filters.min_reviews:
        return False
    if filters.max_reviews is not None and (business.review_count or 0) > filters.max_reviews:
        return False
    if filters.keywords_in_name:
        if filters.keywords_in_name.lower() not in business.business_name.lower():
            return False
    if filters.business_size_tiers:
        tier = _size_tier(business.review_count or 0)
        if tier not in filters.business_size_tiers:
            return False
    return True


async def run_scrape_job(job_id: str, db: Session) -> None:
    """
    Orchestrates a full scrape job:
    1. Load job from DB, mark as running
    2. Scrape Google Maps (streams results via callback)
    3. Enrich all matching businesses with email in parallel (semaphore-limited)
    4. Save each lead to DB as it completes for live progress polling
    5. Mark job done or failed
    """
    job = db.get(SearchJob, job_id)
    if not job:
        return

    job.status = JobStatus.running
    db.commit()

    filters = FiltersSchema(**(job.filters or {}))
    concurrency = int((job.filters or {}).get("_concurrency", 5))
    sem = asyncio.Semaphore(concurrency)

    try:
        def on_business_found(business: BusinessData) -> None:
            job.total_found += 1
            db.commit()

        businesses = await scrape_google_maps(
            keyword=job.keyword,
            location=job.location,
            on_business_found=on_business_found,
            max_results=200,
        )

        filtered = [b for b in businesses if _passes_filters(b, filters)]

        async def enrich_and_save(business: BusinessData) -> None:
            async with sem:
                email: str | None = None
                if business.website:
                    email = await scrape_email_from_website(business.website)

                size_tier = _size_tier(business.review_count or 0)
                lead = Lead(
                    search_job_id=job_id,
                    business_name=business.business_name,
                    category=business.category,
                    address=business.address,
                    phone=business.phone,
                    website=business.website,
                    email=email,
                    rating=business.rating,
                    review_count=business.review_count,
                    business_size_tier=size_tier,
                    latitude=business.latitude,
                    longitude=business.longitude,
                    google_maps_url=business.google_maps_url,
                )
                db.add(lead)
                job.total_scraped += 1
                db.commit()

        await asyncio.gather(*[enrich_and_save(b) for b in filtered])

        job.status = JobStatus.done
        job.completed_at = datetime.now(timezone.utc)
        db.commit()

        # Auto-export leads to the output sheet
        try:
            from ..services import sheets_service
            if sheets_service.credentials_exist():
                leads = db.query(Lead).filter(Lead.search_job_id == job_id).all()
                sheets_service.append_leads_to_output(leads, job.location)
                # Note: row strikethrough is handled by sheet_runner after ALL
                # locations for a business type finish, not here per-job.
        except Exception:
            pass

    except Exception as e:
        job.status = JobStatus.failed
        job.error_message = str(e)
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        raise
