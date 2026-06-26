# Google Maps Lead Scraper — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use godmode:task-runner to implement this plan task-by-task.

**Goal:** Build a personal-use web app that scrapes Google Maps business leads, enriches them with emails from business websites, and manages them in a filterable table with CSV/Excel export.

**Architecture:** Next.js 14 frontend (Vercel) + FastAPI Python backend (Railway) + SQLite (dev) / PostgreSQL (prod). Scraping via Playwright (proven patterns from omkarcloud + FraneCal repos).

**Tech Stack:** Next.js 14, TypeScript, Tailwind, shadcn/ui, FastAPI, SQLAlchemy, Playwright, BeautifulSoup4, pandas, SQLite

---

## Task 1: Project Scaffolding

**Files:**
- Create: `backend/` directory structure
- Create: `frontend/` directory structure
- Create: `backend/requirements.txt`
- Create: `frontend/package.json` (via CLI)
- Create: `.gitignore`

**Step 1: Initialize git repo**

```bash
cd /Users/affanzahir/code/scrapper
git init
```

Expected: `Initialized empty Git repository`

**Step 2: Create backend directory structure**

```bash
mkdir -p backend/routers backend/scraper
touch backend/__init__.py backend/routers/__init__.py backend/scraper/__init__.py
```

**Step 3: Create backend/requirements.txt**

```
fastapi==0.111.0
uvicorn[standard]==0.30.1
sqlalchemy==2.0.30
alembic==1.13.1
playwright==1.44.0
beautifulsoup4==4.12.3
pandas==2.2.2
openpyxl==3.1.4
pydantic==2.7.4
python-multipart==0.0.9
aiofiles==23.2.1
httpx==0.27.0
```

**Step 4: Create Python virtual environment and install deps**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

Expected: `Playwright Chromium installed successfully`

**Step 5: Scaffold Next.js frontend**

```bash
cd /Users/affanzahir/code/scrapper
npx create-next-app@14 frontend --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

Expected: `Success! Created frontend`

**Step 6: Install frontend dependencies**

```bash
cd frontend
npx shadcn@latest init -d
npx shadcn@latest add table button input slider checkbox badge card progress toast sonner
```

**Step 7: Create .gitignore**

```
# Python
backend/venv/
backend/__pycache__/
backend/**/__pycache__/
backend/*.pyc
backend/.env
backend/leads.db

# Node
frontend/node_modules/
frontend/.next/
frontend/.env.local

# General
.DS_Store
*.log
```

**Step 8: Commit**

```bash
cd /Users/affanzahir/code/scrapper
git add .
git commit -m "chore: scaffold backend and frontend project structure"
```

---

## Task 2: Database Models + Migrations

**Files:**
- Create: `backend/database.py`
- Create: `backend/models.py`
- Create: `backend/alembic.ini` (via CLI)
- Create: `backend/alembic/env.py` (via CLI, then modify)

**Step 1: Create backend/database.py**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./leads.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**Step 2: Create backend/models.py**

```python
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text, JSON, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
import enum
from .database import Base

class JobStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    done = "done"
    failed = "failed"

class LeadStatus(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    qualified = "qualified"
    rejected = "rejected"

class BusinessSize(str, enum.Enum):
    small = "small"
    medium = "medium"
    large = "large"

class SearchJob(Base):
    __tablename__ = "search_jobs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    status = Column(SAEnum(JobStatus), default=JobStatus.pending, nullable=False)
    keyword = Column(String, nullable=False)
    location = Column(String, nullable=False)
    filters = Column(JSON, default={})
    total_found = Column(Integer, default=0)
    total_scraped = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    leads = relationship("Lead", back_populates="job", cascade="all, delete-orphan")

def _size_tier(review_count: int) -> BusinessSize:
    if review_count < 50:
        return BusinessSize.small
    if review_count < 500:
        return BusinessSize.medium
    return BusinessSize.large

class Lead(Base):
    __tablename__ = "leads"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    search_job_id = Column(String, ForeignKey("search_jobs.id"), nullable=False)
    business_name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    address = Column(String, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    zip_code = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    website = Column(String, nullable=True)
    email = Column(String, nullable=True)
    rating = Column(Float, nullable=True)
    review_count = Column(Integer, nullable=True)
    business_size_tier = Column(SAEnum(BusinessSize), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    google_maps_url = Column(String, nullable=True)
    status = Column(SAEnum(LeadStatus), default=LeadStatus.new)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    job = relationship("SearchJob", back_populates="leads")
```

**Step 3: Initialize Alembic**

```bash
cd backend
source venv/bin/activate
alembic init alembic
```

**Step 4: Update alembic/env.py** — replace the `target_metadata` line:

```python
# At top of alembic/env.py, add after existing imports:
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from backend.database import Base
from backend import models  # noqa: F401

# Replace: target_metadata = None
# With:
target_metadata = Base.metadata
```

**Step 5: Create initial migration**

```bash
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade  -> xxxx, initial schema`

**Step 6: Verify tables created**

```bash
python3 -c "import sqlite3; conn = sqlite3.connect('leads.db'); print(conn.execute(\"SELECT name FROM sqlite_master WHERE type='table'\").fetchall())"
```

Expected: `[('search_jobs',), ('leads',), ...]`

**Step 7: Commit**

```bash
cd /Users/affanzahir/code/scrapper
git add backend/
git commit -m "feat: add database models and initial migration"
```

---

## Task 3: Pydantic Schemas

**Files:**
- Create: `backend/schemas.py`

**Step 1: Create backend/schemas.py**

```python
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from .models import JobStatus, LeadStatus, BusinessSize

class FiltersSchema(BaseModel):
    min_rating: Optional[float] = None
    max_rating: Optional[float] = None
    has_website: Optional[bool] = None
    has_phone: Optional[bool] = None
    min_reviews: Optional[int] = None
    max_reviews: Optional[int] = None
    business_size_tiers: Optional[List[BusinessSize]] = None
    keywords_in_name: Optional[str] = None

class CreateJobRequest(BaseModel):
    keyword: str
    location: str
    filters: FiltersSchema = FiltersSchema()

class JobResponse(BaseModel):
    id: str
    status: JobStatus
    keyword: str
    location: str
    filters: dict
    total_found: int
    total_scraped: int
    created_at: datetime
    completed_at: Optional[datetime]
    error_message: Optional[str]

    model_config = {"from_attributes": True}

class LeadResponse(BaseModel):
    id: str
    search_job_id: str
    business_name: str
    category: Optional[str]
    address: Optional[str]
    city: Optional[str]
    state: Optional[str]
    zip_code: Optional[str]
    phone: Optional[str]
    website: Optional[str]
    email: Optional[str]
    rating: Optional[float]
    review_count: Optional[int]
    business_size_tier: Optional[BusinessSize]
    latitude: Optional[float]
    longitude: Optional[float]
    google_maps_url: Optional[str]
    status: LeadStatus
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}

class UpdateLeadRequest(BaseModel):
    status: Optional[LeadStatus] = None
    notes: Optional[str] = None
```

**Step 2: Commit**

```bash
git add backend/schemas.py
git commit -m "feat: add pydantic request/response schemas"
```

---

## Task 4: Email Scraper (harvested from FraneCal patterns)

**Files:**
- Create: `backend/scraper/email_scraper.py`

**Step 1: Create backend/scraper/email_scraper.py**

```python
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
    "your@", "user@", "name@", "info@wix", "@w3.org"
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
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        pages_to_check = [url] + [url.rstrip("/") + path for path in CONTACT_PATHS]

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
```

**Step 2: Write a manual smoke test**

```bash
cd backend
source venv/bin/activate
python3 -c "
import asyncio
from scraper.email_scraper import scrape_email_from_website
result = asyncio.run(scrape_email_from_website('https://www.apple.com/contact'))
print('Email found:', result)
"
```

Expected: Some email or `None` — no crash.

**Step 3: Commit**

```bash
git add backend/scraper/email_scraper.py
git commit -m "feat: add website email scraper (harvested FraneCal patterns)"
```

---

## Task 5: Google Maps Scraper (harvested from omkarcloud patterns)

**Files:**
- Create: `backend/scraper/maps_scraper.py`

**Step 1: Create backend/scraper/maps_scraper.py**

```python
import asyncio
import re
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
    """Parse '(1,234)' or '1234 reviews' to int."""
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
        name = await page.locator('h1').first.inner_text(timeout=3000)
    except Exception:
        return None

    data = BusinessData(business_name=name.strip())

    try:
        category_el = page.locator('[jsaction*="category"]').first
        data.category = await category_el.inner_text(timeout=2000)
    except Exception:
        pass

    # Rating
    try:
        rating_el = page.locator('[aria-label*="stars"]').first
        aria = await rating_el.get_attribute("aria-label", timeout=2000)
        if aria:
            data.rating = _parse_rating(aria)
    except Exception:
        pass

    # Review count
    try:
        review_el = page.locator('[aria-label*="reviews"]').first
        aria = await review_el.get_attribute("aria-label", timeout=2000)
        if aria:
            data.review_count = _parse_review_count(aria)
    except Exception:
        pass

    # Address, phone, website from info buttons
    try:
        buttons = await page.locator('[data-item-id]').all()
        for btn in buttons:
            item_id = await btn.get_attribute("data-item-id", timeout=1000)
            text = await btn.inner_text(timeout=1000)
            if item_id and "address" in item_id.lower():
                data.address = text.strip()
            elif item_id and "phone" in item_id.lower():
                data.phone = text.strip()
            elif item_id and "authority" in item_id.lower():
                data.website = text.strip()
    except Exception:
        pass

    # URL for lat/lng
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
    Calls on_business_found callback for each business as it's found.
    Patterns harvested from: omkarcloud/google-maps-scraper, gosom/google-maps-scraper
    """
    results = []
    search_query = f"{keyword} in {location}"

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 900},
        )
        page = await context.new_page()

        # Navigate to Google Maps search
        encoded = search_query.replace(" ", "+")
        await page.goto(f"https://www.google.com/maps/search/{encoded}", timeout=30000)
        await page.wait_for_timeout(2000)

        # Scroll results panel to load all listings
        results_panel = page.locator('[role="feed"]')
        previous_count = 0
        stale_rounds = 0

        while len(results) < max_results and stale_rounds < 5:
            # Get all result cards currently visible
            cards = await page.locator('[role="feed"] > div[jsaction]').all()
            current_count = len(cards)

            if current_count == previous_count:
                stale_rounds += 1
                # Check if we hit "end of list"
                end_marker = page.locator("text=You've reached the end of the list")
                if await end_marker.count() > 0:
                    break
            else:
                stale_rounds = 0
                previous_count = current_count

            # Click each new card and extract data
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

            # Scroll down in the results panel
            await results_panel.evaluate("el => el.scrollBy(0, 1000)")
            await page.wait_for_timeout(1000)

        await browser.close()

    return results
```

**Step 2: Run a manual smoke test**

```bash
cd backend
source venv/bin/activate
python3 -c "
import asyncio
from scraper.maps_scraper import scrape_google_maps

def on_found(b):
    print('Found:', b.business_name, b.phone)

results = asyncio.run(scrape_google_maps('coffee shops', 'Austin TX', on_found, max_results=3))
print('Total:', len(results))
"
```

Expected: 3 business names printed, no crash.

**Step 3: Commit**

```bash
git add backend/scraper/maps_scraper.py
git commit -m "feat: add Google Maps scraper (harvested omkarcloud + gosom patterns)"
```

---

## Task 6: Background Scrape Job Orchestrator

**Files:**
- Create: `backend/scraper/job_runner.py`

**Step 1: Create backend/scraper/job_runner.py**

```python
import asyncio
from datetime import datetime
from sqlalchemy.orm import Session
from ..models import SearchJob, Lead, JobStatus, BusinessSize, _size_tier
from ..schemas import FiltersSchema
from .maps_scraper import scrape_google_maps, BusinessData
from .email_scraper import scrape_email_from_website

def _passes_filters(business: BusinessData, filters: FiltersSchema) -> bool:
    if filters.min_rating and (business.rating or 0) < filters.min_rating:
        return False
    if filters.max_rating and (business.rating or 5) > filters.max_rating:
        return False
    if filters.has_website and not business.website:
        return False
    if filters.has_phone and not business.phone:
        return False
    if filters.min_reviews and (business.review_count or 0) < filters.min_reviews:
        return False
    if filters.max_reviews and (business.review_count or 0) > filters.max_reviews:
        return False
    if filters.keywords_in_name:
        keyword = filters.keywords_in_name.lower()
        if keyword not in business.business_name.lower():
            return False
    if filters.business_size_tiers:
        tier = _size_tier(business.review_count or 0)
        if tier not in filters.business_size_tiers:
            return False
    return True

async def run_scrape_job(job_id: str, db: Session):
    """
    Orchestrates a full scrape job:
    1. Load job from DB
    2. Scrape Google Maps
    3. For each matching business, scrape email from website
    4. Save lead to DB immediately (live progress)
    """
    job = db.get(SearchJob, job_id)
    if not job:
        return

    job.status = JobStatus.running
    db.commit()

    filters = FiltersSchema(**job.filters) if job.filters else FiltersSchema()

    try:
        def on_business_found(business: BusinessData):
            job.total_found += 1
            db.commit()

        businesses = await scrape_google_maps(
            keyword=job.keyword,
            location=job.location,
            on_business_found=on_business_found,
            max_results=200,
        )

        for business in businesses:
            if not _passes_filters(business, filters):
                continue

            # Enrich with email from website
            email = None
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

        job.status = JobStatus.done
        job.completed_at = datetime.utcnow()
        db.commit()

    except Exception as e:
        job.status = JobStatus.failed
        job.error_message = str(e)
        job.completed_at = datetime.utcnow()
        db.commit()
        raise
```

**Step 2: Commit**

```bash
git add backend/scraper/job_runner.py
git commit -m "feat: add job orchestrator with filter + email enrichment pipeline"
```

---

## Task 7: FastAPI Routers

**Files:**
- Create: `backend/routers/jobs.py`
- Create: `backend/routers/leads.py`

**Step 1: Create backend/routers/jobs.py**

```python
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models import SearchJob, Lead
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
        filters=request.filters.model_dump(exclude_none=True),
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
```

**Step 2: Create backend/routers/leads.py**

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import asc, desc
from typing import List, Optional
import pandas as pd
import io
from ..database import get_db
from ..models import Lead, LeadStatus
from ..schemas import LeadResponse, UpdateLeadRequest

router = APIRouter(prefix="/api/leads", tags=["leads"])

@router.get("", response_model=List[LeadResponse])
def list_leads(
    job_id: Optional[str] = None,
    status: Optional[LeadStatus] = None,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
    limit: int = Query(default=500, le=1000),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    q = db.query(Lead)
    if job_id:
        q = q.filter(Lead.search_job_id == job_id)
    if status:
        q = q.filter(Lead.status == status)

    sort_col = getattr(Lead, sort_by, Lead.created_at)
    q = q.order_by(desc(sort_col) if sort_dir == "desc" else asc(sort_col))
    return q.offset(offset).limit(limit).all()

@router.patch("/{lead_id}", response_model=LeadResponse)
def update_lead(lead_id: str, request: UpdateLeadRequest, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if request.status is not None:
        lead.status = request.status
    if request.notes is not None:
        lead.notes = request.notes
    db.commit()
    db.refresh(lead)
    return lead

@router.delete("/{lead_id}")
def delete_lead(lead_id: str, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    db.delete(lead)
    db.commit()
    return {"ok": True}

def _leads_to_df(leads: list) -> pd.DataFrame:
    return pd.DataFrame([{
        "Business Name": l.business_name,
        "Category": l.category,
        "Address": l.address,
        "Phone": l.phone,
        "Email": l.email,
        "Website": l.website,
        "Rating": l.rating,
        "Reviews": l.review_count,
        "Size": l.business_size_tier,
        "Status": l.status,
        "Notes": l.notes,
        "Google Maps URL": l.google_maps_url,
    } for l in leads])

@router.get("/export/csv")
def export_csv(job_id: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Lead)
    if job_id:
        q = q.filter(Lead.search_job_id == job_id)
    leads = q.all()
    df = _leads_to_df(leads)
    output = io.StringIO()
    df.to_csv(output, index=False)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads.csv"}
    )

@router.get("/export/xlsx")
def export_xlsx(job_id: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Lead)
    if job_id:
        q = q.filter(Lead.search_job_id == job_id)
    leads = q.all()
    df = _leads_to_df(leads)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Leads")
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=leads.xlsx"}
    )
```

**Step 3: Commit**

```bash
git add backend/routers/
git commit -m "feat: add jobs and leads API routers with export endpoints"
```

---

## Task 8: FastAPI Main App

**Files:**
- Create: `backend/main.py`

**Step 1: Create backend/main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine
from . import models
from .routers import jobs, leads

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Google Maps Lead Scraper API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs.router)
app.include_router(leads.router)

@app.get("/api/health")
def health():
    return {"status": "ok"}
```

**Step 2: Start backend and verify**

```bash
cd backend
source venv/bin/activate
uvicorn backend.main:app --reload --port 8000
```

Open: http://localhost:8000/docs

Expected: FastAPI Swagger UI with all endpoints listed.

**Step 3: Test health endpoint**

```bash
curl http://localhost:8000/api/health
```

Expected: `{"status":"ok"}`

**Step 4: Commit**

```bash
git add backend/main.py
git commit -m "feat: add FastAPI main app with CORS and router registration"
```

---

## Task 9: Frontend API Client

**Files:**
- Create: `frontend/lib/api.ts`
- Create: `frontend/lib/types.ts`

**Step 1: Create frontend/lib/types.ts**

```typescript
export type JobStatus = "pending" | "running" | "done" | "failed";
export type LeadStatus = "new" | "contacted" | "qualified" | "rejected";
export type BusinessSize = "small" | "medium" | "large";

export interface Filters {
  min_rating?: number;
  max_rating?: number;
  has_website?: boolean;
  has_phone?: boolean;
  min_reviews?: number;
  max_reviews?: number;
  business_size_tiers?: BusinessSize[];
  keywords_in_name?: string;
}

export interface SearchJob {
  id: string;
  status: JobStatus;
  keyword: string;
  location: string;
  filters: Filters;
  total_found: number;
  total_scraped: number;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface Lead {
  id: string;
  search_job_id: string;
  business_name: string;
  category?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  website?: string;
  email?: string;
  rating?: number;
  review_count?: number;
  business_size_tier?: BusinessSize;
  latitude?: number;
  longitude?: number;
  google_maps_url?: string;
  status: LeadStatus;
  notes?: string;
  created_at: string;
}
```

**Step 2: Create frontend/lib/api.ts**

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

export const api = {
  jobs: {
    create: (keyword: string, location: string, filters: object) =>
      apiFetch("/api/jobs", {
        method: "POST",
        body: JSON.stringify({ keyword, location, filters }),
      }),
    list: () => apiFetch("/api/jobs"),
    get: (id: string) => apiFetch(`/api/jobs/${id}`),
    delete: (id: string) => apiFetch(`/api/jobs/${id}`, { method: "DELETE" }),
  },
  leads: {
    list: (params?: { job_id?: string; status?: string }) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      return apiFetch(`/api/leads${qs ? "?" + qs : ""}`);
    },
    update: (id: string, data: { status?: string; notes?: string }) =>
      apiFetch(`/api/leads/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/api/leads/${id}`, { method: "DELETE" }),
    exportCsv: (jobId?: string) => {
      const qs = jobId ? `?job_id=${jobId}` : "";
      window.open(`${BASE_URL}/api/leads/export/csv${qs}`);
    },
    exportXlsx: (jobId?: string) => {
      const qs = jobId ? `?job_id=${jobId}` : "";
      window.open(`${BASE_URL}/api/leads/export/xlsx${qs}`);
    },
  },
};
```

**Step 3: Commit**

```bash
cd /Users/affanzahir/code/scrapper
git add frontend/lib/
git commit -m "feat: add frontend API client and TypeScript types"
```

---

## Task 10: Search Screen (Frontend)

**Files:**
- Modify: `frontend/app/page.tsx`
- Create: `frontend/components/FilterPanel.tsx`
- Create: `frontend/components/ProgressCard.tsx`

**Step 1: Create frontend/components/FilterPanel.tsx**

```typescript
"use client";
import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Filters, BusinessSize } from "@/lib/types";

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
}

export function FilterPanel({ filters, onChange }: Props) {
  const sizes: BusinessSize[] = ["small", "medium", "large"];

  const toggleSize = (size: BusinessSize) => {
    const current = filters.business_size_tiers || [];
    const next = current.includes(size)
      ? current.filter((s) => s !== size)
      : [...current, size];
    onChange({ ...filters, business_size_tiers: next });
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
      <h3 className="font-semibold text-sm">Filters</h3>

      <div>
        <Label>Min Rating: {filters.min_rating ?? 1}</Label>
        <Slider
          min={1} max={5} step={0.5}
          value={[filters.min_rating ?? 1]}
          onValueChange={([v]) => onChange({ ...filters, min_rating: v })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Min Reviews</Label>
          <Input
            type="number" placeholder="0"
            value={filters.min_reviews ?? ""}
            onChange={(e) => onChange({ ...filters, min_reviews: Number(e.target.value) || undefined })}
          />
        </div>
        <div>
          <Label>Max Reviews</Label>
          <Input
            type="number" placeholder="Any"
            value={filters.max_reviews ?? ""}
            onChange={(e) => onChange({ ...filters, max_reviews: Number(e.target.value) || undefined })}
          />
        </div>
      </div>

      <div>
        <Label>Business Size</Label>
        <div className="flex gap-4 mt-1">
          {sizes.map((s) => (
            <div key={s} className="flex items-center gap-1">
              <Checkbox
                id={s}
                checked={(filters.business_size_tiers || []).includes(s)}
                onCheckedChange={() => toggleSize(s)}
              />
              <label htmlFor={s} className="capitalize text-sm">{s}</label>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="has_website"
            checked={!!filters.has_website}
            onCheckedChange={(v) => onChange({ ...filters, has_website: !!v })}
          />
          <label htmlFor="has_website" className="text-sm">Has Website</label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="has_phone"
            checked={!!filters.has_phone}
            onCheckedChange={(v) => onChange({ ...filters, has_phone: !!v })}
          />
          <label htmlFor="has_phone" className="text-sm">Has Phone</label>
        </div>
      </div>

      <div>
        <Label>Keyword in Name</Label>
        <Input
          placeholder="e.g. plumbing"
          value={filters.keywords_in_name ?? ""}
          onChange={(e) => onChange({ ...filters, keywords_in_name: e.target.value || undefined })}
        />
      </div>
    </div>
  );
}
```

**Step 2: Modify frontend/app/page.tsx**

```typescript
"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FilterPanel } from "@/components/FilterPanel";
import { api } from "@/lib/api";
import { Filters, SearchJob } from "@/lib/types";

export default function SearchPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [activeJob, setActiveJob] = useState<SearchJob | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const startScrape = async () => {
    if (!keyword || !location) return;
    setLoading(true);
    try {
      const job = await api.jobs.create(keyword, location, filters) as SearchJob;
      setActiveJob(job);
      pollJob(job.id);
    } finally {
      setLoading(false);
    }
  };

  const pollJob = (jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const job = await api.jobs.get(jobId) as SearchJob;
      setActiveJob(job);
      if (job.status === "done" || job.status === "failed") {
        clearInterval(pollRef.current!);
        if (job.status === "done") {
          setTimeout(() => router.push(`/leads?job_id=${jobId}`), 1000);
        }
      }
    }, 2000);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  return (
    <main className="max-w-2xl mx-auto p-8 space-y-6">
      <h1 className="text-3xl font-bold">Google Maps Lead Scraper</h1>

      <Card>
        <CardHeader><CardTitle>Search</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Business type (e.g. dentists)" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <Input placeholder="Location (e.g. Austin, TX)" value={location} onChange={(e) => setLocation(e.target.value)} />
          <FilterPanel filters={filters} onChange={setFilters} />
          <div className="flex gap-2">
            <Button onClick={startScrape} disabled={loading || activeJob?.status === "running"} className="flex-1">
              {loading ? "Starting..." : activeJob?.status === "running" ? "Scraping..." : "Start Scraping"}
            </Button>
            <Button variant="outline" onClick={() => router.push("/history")}>History</Button>
          </div>
        </CardContent>
      </Card>

      {activeJob && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">{activeJob.keyword} in {activeJob.location}</span>
              <Badge variant={activeJob.status === "done" ? "default" : activeJob.status === "failed" ? "destructive" : "secondary"}>
                {activeJob.status}
              </Badge>
            </div>
            <Progress value={activeJob.total_found > 0 ? (activeJob.total_scraped / activeJob.total_found) * 100 : 0} />
            <p className="text-sm text-gray-500">{activeJob.total_scraped} leads scraped of {activeJob.total_found} found</p>
            {activeJob.error_message && <p className="text-sm text-red-500">{activeJob.error_message}</p>}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
```

**Step 3: Verify frontend renders**

```bash
cd frontend
npm run dev
```

Open http://localhost:3000 — verify search form and filter panel render with no console errors.

**Step 4: Commit**

```bash
git add frontend/
git commit -m "feat: add search screen with filter panel and live progress"
```

---

## Task 11: Leads Table Screen (Frontend)

**Files:**
- Create: `frontend/app/leads/page.tsx`
- Create: `frontend/components/LeadsTable.tsx`

**Step 1: Create frontend/components/LeadsTable.tsx**

```typescript
"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { Lead, LeadStatus } from "@/lib/types";

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "secondary",
  contacted: "default",
  qualified: "default",
  rejected: "destructive",
};

interface Props {
  leads: Lead[];
  jobId?: string;
  onLeadUpdated: (lead: Lead) => void;
}

export function LeadsTable({ leads, jobId, onLeadUpdated }: Props) {
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");

  const updateStatus = async (lead: Lead, status: LeadStatus) => {
    const updated = await api.leads.update(lead.id, { status }) as Lead;
    onLeadUpdated(updated);
  };

  const saveNotes = async (lead: Lead) => {
    const updated = await api.leads.update(lead.id, { notes: notesValue }) as Lead;
    onLeadUpdated(updated);
    setEditingNotes(null);
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-2 mb-4">
        <Button size="sm" variant="outline" onClick={() => api.leads.exportCsv(jobId)}>Export CSV</Button>
        <Button size="sm" variant="outline" onClick={() => api.leads.exportXlsx(jobId)}>Export Excel</Button>
      </div>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b bg-gray-50">
            {["Name", "Category", "Phone", "Email", "Rating", "Reviews", "Size", "Website", "Status", "Notes"].map(h => (
              <th key={h} className="p-2 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b hover:bg-gray-50">
              <td className="p-2 font-medium max-w-[180px] truncate">
                {lead.google_maps_url ? (
                  <a href={lead.google_maps_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    {lead.business_name}
                  </a>
                ) : lead.business_name}
              </td>
              <td className="p-2 text-gray-600 max-w-[120px] truncate">{lead.category}</td>
              <td className="p-2">{lead.phone}</td>
              <td className="p-2 text-blue-600">
                {lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : <span className="text-gray-400">—</span>}
              </td>
              <td className="p-2">{lead.rating?.toFixed(1)}</td>
              <td className="p-2">{lead.review_count?.toLocaleString()}</td>
              <td className="p-2 capitalize">{lead.business_size_tier}</td>
              <td className="p-2 max-w-[120px] truncate">
                {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{lead.website}</a>}
              </td>
              <td className="p-2">
                <select
                  value={lead.status}
                  onChange={(e) => updateStatus(lead, e.target.value as LeadStatus)}
                  className="text-xs border rounded px-1 py-0.5"
                >
                  {(["new", "contacted", "qualified", "rejected"] as LeadStatus[]).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </td>
              <td className="p-2">
                {editingNotes === lead.id ? (
                  <div className="flex gap-1">
                    <Input className="h-6 text-xs" value={notesValue} onChange={(e) => setNotesValue(e.target.value)} />
                    <Button size="sm" className="h-6 text-xs px-2" onClick={() => saveNotes(lead)}>Save</Button>
                  </div>
                ) : (
                  <span
                    className="cursor-pointer text-gray-500 hover:text-black"
                    onClick={() => { setEditingNotes(lead.id); setNotesValue(lead.notes ?? ""); }}
                  >
                    {lead.notes || <span className="text-gray-300">Add note</span>}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {leads.length === 0 && <p className="text-center text-gray-400 py-8">No leads found.</p>}
    </div>
  );
}
```

**Step 2: Create frontend/app/leads/page.tsx**

```typescript
"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LeadsTable } from "@/components/LeadsTable";
import { api } from "@/lib/api";
import { Lead } from "@/lib/types";

export default function LeadsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const jobId = params.get("job_id") ?? undefined;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.leads.list({ job_id: jobId }).then((data) => {
      setLeads(data as Lead[]);
      setLoading(false);
    });
  }, [jobId]);

  const handleUpdated = (updated: Lead) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  };

  return (
    <main className="max-w-7xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Leads {jobId && `(Job)`}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/")}>New Search</Button>
          <Button variant="outline" onClick={() => router.push("/history")}>History</Button>
        </div>
      </div>
      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <LeadsTable leads={leads} jobId={jobId} onLeadUpdated={handleUpdated} />
      )}
    </main>
  );
}
```

**Step 3: Commit**

```bash
git add frontend/
git commit -m "feat: add leads table with inline status/notes editing and export"
```

---

## Task 12: Job History Screen (Frontend)

**Files:**
- Create: `frontend/app/history/page.tsx`

**Step 1: Create frontend/app/history/page.tsx**

```typescript
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { SearchJob } from "@/lib/types";

export default function HistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<SearchJob[]>([]);

  useEffect(() => {
    api.jobs.list().then((data) => setJobs(data as SearchJob[]));
  }, []);

  const deleteJob = async (id: string) => {
    await api.jobs.delete(id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  return (
    <main className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Scrape History</h1>
        <Button onClick={() => router.push("/")}>New Search</Button>
      </div>
      <div className="space-y-3">
        {jobs.map((job) => (
          <div key={job.id} className="border rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{job.keyword} in {job.location}</p>
              <p className="text-sm text-gray-500">
                {job.total_scraped} leads · {new Date(job.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={job.status === "done" ? "default" : job.status === "failed" ? "destructive" : "secondary"}>
                {job.status}
              </Badge>
              <Button size="sm" variant="outline" onClick={() => router.push(`/leads?job_id=${job.id}`)}>
                View
              </Button>
              <Button size="sm" variant="ghost" onClick={() => deleteJob(job.id)} className="text-red-500">
                Delete
              </Button>
            </div>
          </div>
        ))}
        {jobs.length === 0 && <p className="text-gray-400 text-center py-8">No scrape jobs yet.</p>}
      </div>
    </main>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/app/history/
git commit -m "feat: add job history screen with view/delete actions"
```

---

## Task 13: Environment Config + README

**Files:**
- Create: `frontend/.env.local`
- Create: `backend/.env`
- Create: `README.md`

**Step 1: Create frontend/.env.local**

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Step 2: Create backend/.env**

```
DATABASE_URL=sqlite:///./leads.db
```

**Step 3: Create README.md**

```markdown
# Google Maps Lead Scraper

Personal-use web app that scrapes business leads from Google Maps and enriches them with emails from business websites.

## Setup

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
uvicorn backend.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Deploy

- **Frontend**: Push `frontend/` to Vercel, set `NEXT_PUBLIC_API_URL` to your Railway backend URL
- **Backend**: Deploy `backend/` to Railway, set `DATABASE_URL` to PostgreSQL connection string
```

**Step 4: Final commit**

```bash
git add README.md frontend/.env.local backend/.env
git commit -m "chore: add environment config and README"
```

---

## Task 14: End-to-End Verification

**Step 1: Start both servers**

Terminal 1:
```bash
cd backend && source venv/bin/activate && uvicorn backend.main:app --reload --port 8000
```

Terminal 2:
```bash
cd frontend && npm run dev
```

**Step 2: Run a real scrape**

1. Open http://localhost:3000
2. Enter keyword: `coffee shops`, location: `Austin, TX`
3. Set min rating: 4.0
4. Click "Start Scraping"
5. Verify progress bar updates every 2 seconds
6. Verify redirect to `/leads` when done

**Step 3: Verify lead data**

```bash
curl http://localhost:8000/api/leads | python3 -m json.tool | head -50
```

Expected: JSON array of leads with business_name, phone, email fields.

**Step 4: Test export**

- Click "Export CSV" → verify file downloads
- Click "Export Excel" → verify file downloads

**Step 5: Test inline editing**

- Change a lead status to "contacted"
- Add a note
- Refresh page → verify changes persisted

**Step 6: Commit**

```bash
git add .
git commit -m "chore: complete end-to-end verification"
```

---

## Summary

| Task | What It Builds |
|------|---------------|
| 1 | Project scaffolding (backend + frontend) |
| 2 | Database models + SQLite migration |
| 3 | Pydantic schemas |
| 4 | Email scraper (FraneCal patterns) |
| 5 | Google Maps scraper (omkarcloud + gosom patterns) |
| 6 | Job orchestrator (filter + enrich pipeline) |
| 7 | FastAPI routers (jobs + leads + export) |
| 8 | FastAPI main app |
| 9 | Frontend API client + types |
| 10 | Search screen + filter panel |
| 11 | Leads table (sort, filter, inline edit, export) |
| 12 | Job history screen |
| 13 | Env config + README |
| 14 | End-to-end verification |
