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
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    model_config = {"from_attributes": True}


class LeadResponse(BaseModel):
    id: str
    search_job_id: str
    business_name: str
    category: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    rating: Optional[float] = None
    review_count: Optional[int] = None
    business_size_tier: Optional[BusinessSize] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    google_maps_url: Optional[str] = None
    status: LeadStatus
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UpdateLeadRequest(BaseModel):
    status: Optional[LeadStatus] = None
    notes: Optional[str] = None
