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
        headers={"Content-Disposition": "attachment; filename=leads.csv"},
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
        headers={"Content-Disposition": "attachment; filename=leads.xlsx"},
    )


@router.get("", response_model=List[LeadResponse])
def list_leads(
    job_id: Optional[str] = None,
    group_id: Optional[str] = None,
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
    if group_id:
        from ..models import LeadGroup
        q = q.join(LeadGroup, Lead.id == LeadGroup.lead_id).filter(
            LeadGroup.group_id == group_id
        )
    if status:
        q = q.filter(Lead.status == status)
    sort_col = getattr(Lead, sort_by, Lead.created_at)
    q = q.order_by(desc(sort_col) if sort_dir == "desc" else asc(sort_col))
    return q.offset(offset).limit(limit).all()


@router.patch("/{lead_id}", response_model=LeadResponse)
def update_lead(
    lead_id: str, request: UpdateLeadRequest, db: Session = Depends(get_db)
):
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
    return pd.DataFrame(
        [
            {
                "Business Name": l.business_name,
                "Category": l.category,
                "Address": l.address,
                "Phone": l.phone,
                "Email": l.email,
                "Website": l.website,
                "Rating": l.rating,
                "Reviews": l.review_count,
                "Size": str(l.business_size_tier.value) if l.business_size_tier else None,
                "Status": str(l.status.value) if l.status else None,
                "Notes": l.notes,
                "Google Maps URL": l.google_maps_url,
            }
            for l in leads
        ]
    )
