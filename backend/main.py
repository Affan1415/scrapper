from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine
from . import models
from .routers import jobs, leads, groups

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Google Maps Lead Scraper API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs.router)
app.include_router(leads.router)
app.include_router(groups.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
