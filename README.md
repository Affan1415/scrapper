# Google Maps Lead Scraper

A personal-use web app that scrapes small business leads from Google Maps, enriches them with emails from business websites, and manages them in a filterable table with CSV/Excel export.

## Features

- Search Google Maps by business type + location
- Filter by rating, review count, business size, website/phone presence
- Automatic email enrichment — visits each business website to find contact emails
- Leads table with inline status tracking (New → Contacted → Qualified → Rejected)
- Inline notes editing
- Export to CSV or Excel
- Full scrape history with re-run support

## Quick Start

### Backend

```bash
cd backend
python3.11 -m venv venv
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

Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + TypeScript + Tailwind + shadcn/ui |
| Backend | FastAPI (Python 3.11) |
| Scraping | Playwright + BeautifulSoup4 |
| Database | SQLite (dev) → PostgreSQL (prod) |
| Export | pandas + openpyxl |

## Deployment

- **Frontend** → Vercel: set `NEXT_PUBLIC_API_URL` to your backend URL
- **Backend** → Railway/Render: set `DATABASE_URL` to PostgreSQL connection string

## Scraping Reference Implementations

This project harvests patterns from:
- [omkarcloud/google-maps-scraper](https://github.com/omkarcloud/google-maps-scraper) — Google Maps Playwright extraction logic
- [FraneCal/google-maps-scraper](https://github.com/FraneCal/google-maps-scraper) — Two-phase email extraction
- [gosom/google-maps-scraper](https://github.com/gosom/google-maps-scraper) — Scraping architecture patterns
