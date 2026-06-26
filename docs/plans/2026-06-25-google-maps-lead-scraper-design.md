# Google Maps Lead Scraper — Design Document

**Date:** 2026-06-25
**Status:** Approved

---

## Goal

A personal-use web application that scrapes small business leads from Google Maps, enriches them with emails scraped from business websites, and presents them in a filterable table with export and pipeline management.

---

## Architecture

```
[Next.js 14 Frontend (Vercel)]
         ↕ REST API (polling for live progress)
[FastAPI Backend (Railway/Render/AWS)]
         ↕
[Playwright → Google Maps scraper]
         ↕
[Playwright + BeautifulSoup → Business website email scraper]
         ↕
[SQLite (dev) / PostgreSQL (prod)]
```

---

## Reference Repos (Pattern Sources)

| Repo | Stars | License | What We Harvest |
|------|-------|---------|-----------------|
| omkarcloud/google-maps-scraper | 2.4k+ | MIT | Playwright scroll/extraction logic, 50+ data point patterns, anti-detection |
| FraneCal/google-maps-scraper | — | MIT | Two-phase email extraction: visit website → regex extract emails |
| kaymen99/google-maps-lead-generator | — | MIT | FastAPI + React architecture, background job patterns |
| gosom/google-maps-scraper | 3.5k | MIT | Filter/export UX patterns, Web UI design |

---

## Data Model

### SearchJob
```
id              UUID primary key
status          enum: pending | running | done | failed
keyword         string (e.g. "plumbers")
location        string (e.g. "Austin, TX")
filters         JSON {
                  min_rating: float,
                  max_rating: float,
                  has_website: bool,
                  has_phone: bool,
                  min_reviews: int,
                  max_reviews: int,
                  business_size_tier: small|medium|large,
                  keywords_in_name: string
                }
total_found     int
total_scraped   int
created_at      datetime
completed_at    datetime
error_message   string (nullable)
```

### Lead
```
id                  UUID primary key
search_job_id       FK → SearchJob
business_name       string
category            string
address             string
city                string
state               string
zip_code            string
phone               string
website             string
email               string (scraped from website, nullable)
rating              float
review_count        int
business_size_tier  enum: small (<50 reviews) | medium (50-500) | large (500+)
latitude            float
longitude           float
google_maps_url     string
status              enum: new | contacted | qualified | rejected
notes               text
created_at          datetime
```

---

## Scraping Pipeline

```
1. FastAPI receives POST /api/jobs with keyword + location + filters
2. BackgroundTask spawns scrape_job(job_id)
3. Playwright opens Google Maps → searches "{keyword} in {location}"
4. Scrolls result list, collects all visible business cards
5. For each business card:
   a. Extracts: name, address, phone, website, rating, review_count, category, coords
   b. Applies filters → skip if does not match
   c. Derives business_size_tier from review_count
   d. If has website → visits site, extracts emails via regex + checks /contact and /about pages
   e. Saves lead to DB immediately (enables live progress polling)
   f. Updates job.total_scraped++
6. On completion: job.status = done
7. On error: job.status = failed, stores error_message
```

### Email Extraction Logic (harvested from FraneCal patterns)
```
1. Visit business website with Playwright (handles JS-rendered pages)
2. Extract all text + anchor hrefs from page
3. Regex: r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
4. Filter out false positives (noreply@, example@, @sentry.io, etc.)
5. Also check /contact and /about pages if no email on homepage
6. Return first valid email found
```

---

## UI Screens

### Screen 1: Search & Launch
- Keyword input (e.g. "dentists")
- Location input (e.g. "New York, NY")
- Filter panel:
  - Rating range slider (1.0 – 5.0)
  - Min/max reviews inputs
  - Business size checkboxes (Small / Medium / Large)
  - Toggles: Has Website, Has Phone Number
  - Keywords in name input
- "Start Scraping" button
- Live progress bar + counter (X leads found so far, polls every 2s)

### Screen 2: Leads Table
- Columns: Name, Category, Address, Phone, Email, Rating, Reviews, Size, Website, Status, Notes
- Sortable by any column
- Filter bar (re-filter already-scraped leads client-side)
- Inline status dropdown (New / Contacted / Qualified / Rejected)
- Inline notes editing
- Row selection + bulk export
- Export button → CSV or Excel

### Screen 3: Job History
- List of past scrape jobs with status, keyword, location, count, date
- Re-run button (clones job with same filters)
- View results button (loads leads into table)
- Delete job + its leads

---

## API Endpoints

```
POST   /api/jobs              → create scrape job, returns job_id
GET    /api/jobs              → list all jobs
GET    /api/jobs/{id}         → get job status + progress
DELETE /api/jobs/{id}         → delete job + leads

GET    /api/leads             → list leads (filter, sort, paginate)
PATCH  /api/leads/{id}        → update status/notes
DELETE /api/leads/{id}        → delete lead

GET    /api/leads/export/csv  → download CSV
GET    /api/leads/export/xlsx → download Excel
```

---

## Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | Next.js 14 + TypeScript | Vercel-native deployment |
| UI components | Tailwind CSS + shadcn/ui | Polished table/filter components |
| Backend | FastAPI (Python 3.11+) | Async, background tasks, fast |
| Scraping | Playwright (Python) | Handles JS-rendered Google Maps |
| HTML parsing | BeautifulSoup4 | Email extraction from static HTML |
| Database | SQLite → PostgreSQL | Zero-config dev, Railway prod |
| ORM | SQLAlchemy + Alembic | Type-safe queries + migrations |
| Export | pandas + openpyxl | CSV/Excel generation |
| Deployment | Vercel (frontend) + Railway (backend) | Easy, affordable |

---

## Project Structure

```
scrapper/
├── frontend/                   # Next.js app
│   ├── app/
│   │   ├── page.tsx            # Search & launch screen
│   │   ├── leads/page.tsx      # Leads table screen
│   │   └── history/page.tsx    # Job history screen
│   ├── components/
│   │   ├── SearchForm.tsx
│   │   ├── LeadsTable.tsx
│   │   ├── FilterPanel.tsx
│   │   └── JobHistory.tsx
│   └── lib/
│       └── api.ts              # API client (fetch wrappers)
│
├── backend/                    # FastAPI app
│   ├── main.py                 # App entry point + CORS
│   ├── database.py             # SQLAlchemy engine + session
│   ├── models.py               # SearchJob + Lead ORM models
│   ├── schemas.py              # Pydantic request/response schemas
│   ├── routers/
│   │   ├── jobs.py             # /api/jobs endpoints
│   │   └── leads.py            # /api/leads endpoints
│   └── scraper/
│       ├── maps_scraper.py     # Google Maps Playwright scraper
│       └── email_scraper.py    # Website email extractor
│
└── docs/plans/
    ├── 2026-06-25-google-maps-lead-scraper-design.md  (this file)
    └── 2026-06-25-google-maps-lead-scraper-plan.md    (implementation plan)
```

---

## Deployment

| Environment | Frontend | Backend | Database |
|-------------|----------|---------|----------|
| Local dev | `npm run dev` port 3000 | `uvicorn` port 8000 | SQLite file |
| Production | Vercel | Railway | PostgreSQL (Railway) |
