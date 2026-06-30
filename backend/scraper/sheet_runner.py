import asyncio
from ..database import SessionLocal
from ..models import SearchJob
from ..scraper.job_runner import run_scrape_job
from ..services import sheets_service


async def _run_and_mark(job_id: str, db, sheet_row: int, sheet_col: int, sem: asyncio.Semaphore) -> None:
    """Run a scrape job, marking the cell ⏳ on start and ✓ on finish."""
    async with sem:
        sheets_service.mark_cell_running(sheet_row, sheet_col)
        await run_scrape_job(job_id, db)
        sheets_service.mark_cell_done(sheet_row, sheet_col)


async def run_sheet_batch(groups: list[dict], parallel_jobs: int = 10) -> None:
    """
    Process input sheet groups SEQUENTIALLY by business type.

    For each business type:
      1. Create one job per pending location
      2. Run up to `parallel_jobs` location jobs concurrently (semaphore-limited)
      3. Each job marks its own cell (✓) as soon as it finishes
      4. After ALL locations complete → cross out the entire row
      5. Move to the next business type
    """
    db = SessionLocal()
    sem = asyncio.Semaphore(max(1, parallel_jobs))
    try:
        for group in groups:
            keyword = group["keyword"]
            sheet_row = group["row"]
            pending = [loc for loc in group["locations"] if not loc.get("done")]

            if not pending:
                continue

            # Create all jobs for this business type upfront
            tasks = []
            for loc in pending:
                job = SearchJob(
                    keyword=keyword,
                    location=loc["location"],
                    filters={
                        "_sheet_row": sheet_row,
                        "_sheet_col": loc["col"],
                    },
                )
                db.add(job)
                db.commit()
                db.refresh(job)
                tasks.append(_run_and_mark(job.id, db, sheet_row, loc["col"], sem))

            # Run all locations for this business type with concurrency cap
            # Each marks its own cell the moment it finishes
            await asyncio.gather(*tasks)

            # All locations done — cross out the entire business type row
            sheets_service.strikethrough_row(sheet_row)

    finally:
        db.close()
