import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, DateTime, Text, JSON, ForeignKey, Enum as SAEnum
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


def _size_tier(review_count: int) -> "BusinessSize":
    if review_count < 50:
        return BusinessSize.small
    if review_count < 500:
        return BusinessSize.medium
    return BusinessSize.large


class SearchJob(Base):
    __tablename__ = "search_jobs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    status = Column(SAEnum(JobStatus), default=JobStatus.pending, nullable=False)
    keyword = Column(String, nullable=False)
    location = Column(String, nullable=False)
    filters = Column(JSON, default=lambda: {})
    total_found = Column(Integer, default=0)
    total_scraped = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)

    leads = relationship("Lead", back_populates="job", cascade="all, delete-orphan")


class Lead(Base):
    __tablename__ = "leads"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    search_job_id = Column(String, ForeignKey("search_jobs.id"), nullable=False, index=True)
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
    status = Column(SAEnum(LeadStatus), default=LeadStatus.new, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    job = relationship("SearchJob", back_populates="leads")
    groups = relationship("Group", secondary="lead_groups", back_populates="leads")


class Group(Base):
    __tablename__ = "groups"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    color = Column(String, nullable=False, default="#0369A1")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    leads = relationship("Lead", secondary="lead_groups", back_populates="groups")


class LeadGroup(Base):
    __tablename__ = "lead_groups"

    lead_id = Column(String, ForeignKey("leads.id", ondelete="CASCADE"), primary_key=True)
    group_id = Column(String, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True)
