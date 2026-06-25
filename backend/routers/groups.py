from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from ..database import get_db
from ..models import Group, Lead, LeadGroup
from ..schemas import CreateGroupRequest, UpdateGroupRequest, GroupSummary

router = APIRouter(prefix="/api/groups", tags=["groups"])


@router.get("", response_model=List[GroupSummary])
def list_groups(db: Session = Depends(get_db)):
    groups = db.query(Group).order_by(Group.created_at).all()
    result = []
    for g in groups:
        count = db.query(func.count(LeadGroup.lead_id)).filter(
            LeadGroup.group_id == g.id
        ).scalar()
        result.append(GroupSummary(
            id=g.id, name=g.name, color=g.color, lead_count=count or 0
        ))
    return result


@router.post("", response_model=GroupSummary)
def create_group(request: CreateGroupRequest, db: Session = Depends(get_db)):
    group = Group(name=request.name, color=request.color)
    db.add(group)
    db.commit()
    db.refresh(group)
    return GroupSummary(id=group.id, name=group.name, color=group.color, lead_count=0)


@router.patch("/{group_id}", response_model=GroupSummary)
def update_group(group_id: str, request: UpdateGroupRequest, db: Session = Depends(get_db)):
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if request.name is not None:
        group.name = request.name
    if request.color is not None:
        group.color = request.color
    db.commit()
    db.refresh(group)
    count = db.query(func.count(LeadGroup.lead_id)).filter(
        LeadGroup.group_id == group_id
    ).scalar()
    return GroupSummary(id=group.id, name=group.name, color=group.color, lead_count=count or 0)


@router.delete("/{group_id}")
def delete_group(group_id: str, db: Session = Depends(get_db)):
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    db.delete(group)
    db.commit()
    return {"ok": True}


@router.post("/{group_id}/leads/{lead_id}")
def add_lead_to_group(group_id: str, lead_id: str, db: Session = Depends(get_db)):
    if not db.get(Group, group_id):
        raise HTTPException(status_code=404, detail="Group not found")
    if not db.get(Lead, lead_id):
        raise HTTPException(status_code=404, detail="Lead not found")
    existing = db.query(LeadGroup).filter(
        LeadGroup.lead_id == lead_id,
        LeadGroup.group_id == group_id
    ).first()
    if not existing:
        db.add(LeadGroup(lead_id=lead_id, group_id=group_id))
        db.commit()
    return {"ok": True}


@router.delete("/{group_id}/leads/{lead_id}")
def remove_lead_from_group(group_id: str, lead_id: str, db: Session = Depends(get_db)):
    junction = db.query(LeadGroup).filter(
        LeadGroup.lead_id == lead_id,
        LeadGroup.group_id == group_id
    ).first()
    if junction:
        db.delete(junction)
        db.commit()
    return {"ok": True}
