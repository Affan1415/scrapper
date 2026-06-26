from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import SearchJob
from ..schemas import CreateJobRequest, JobResponse
from ..scraper.job_runner import run_scrape_job

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.post("", response_model=JobResponse)
async def create_job(
    request: CreateJobRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    job = SearchJob(
        keyword=request.keyword,
        location=request.location,
        filters={
            **request.filters.model_dump(exclude_none=True),
            "_concurrency": max(1, min(10, request.concurrency)),
        },
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    background_tasks.add_task(run_scrape_job, job.id, db)
    return job


@router.get("", response_model=List[JobResponse])
def list_jobs(db: Session = Depends(get_db)):
    return db.query(SearchJob).order_by(SearchJob.created_at.desc()).all()


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.get(SearchJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.delete("/{job_id}")
def delete_job(job_id: str, db: Session = Depends(get_db)):
    job = db.get(SearchJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    db.delete(job)
    db.commit()
    return {"ok": True}
