# Groups Feature — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use godmode:task-runner to implement this plan task-by-task.

**Goal:** Add a Groups (tags) system — leads can belong to multiple groups. Groups sidebar on leads page, colored badges on rows, filter by group.

**Architecture:** New `Group` + `LeadGroup` (junction) tables. 6 new API endpoints. Groups sidebar component + leads table updates.

**Tech Stack:** SQLAlchemy + Alembic (backend), Next.js + Tailwind (frontend)

---

## Task 1: Group + LeadGroup Models

**Files:**
- Modify: `backend/models.py`

**Step 1: Add to backend/models.py** (after the Lead class):

```python
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
```

**Step 2: Add `groups` relationship to Lead** (inside Lead class, after `notes`):

```python
    groups = relationship("Group", secondary="lead_groups", back_populates="leads")
```

**Step 3: Generate and apply migration**

```bash
cd /Users/affanzahir/code/scrapper/backend
source venv/bin/activate
alembic revision --autogenerate -m "add groups and lead_groups tables"
alembic upgrade head
```

Verify:
```bash
python3 -c "
import sqlite3
conn = sqlite3.connect('leads.db')
tables = [r[0] for r in conn.execute(\"SELECT name FROM sqlite_master WHERE type='table'\").fetchall()]
print('Tables:', tables)
"
```
Expected: includes `groups` and `lead_groups`.

**Step 4: Commit**
```bash
cd /Users/affanzahir/code/scrapper
git add backend/models.py backend/alembic/
git commit -m "feat: add Group and LeadGroup models with many-to-many relationship"
```

---

## Task 2: Group Schemas

**Files:**
- Modify: `backend/schemas.py`

**Add to backend/schemas.py:**

```python
class GroupBase(BaseModel):
    name: str
    color: str = "#0369A1"

class CreateGroupRequest(GroupBase):
    pass

class UpdateGroupRequest(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

class GroupSummary(BaseModel):
    id: str
    name: str
    color: str
    lead_count: int = 0
    model_config = {"from_attributes": True}

class GroupInLead(BaseModel):
    id: str
    name: str
    color: str
    model_config = {"from_attributes": True}
```

**Update LeadResponse** to include groups:

```python
# Add to LeadResponse:
    groups: List[GroupInLead] = []
```

Verify imports:
```bash
cd /Users/affanzahir/code/scrapper
backend/venv/bin/python3 -c "
import sys; sys.path.insert(0,'.')
from backend.schemas import CreateGroupRequest, GroupSummary, GroupInLead, LeadResponse
print('OK')
"
```

**Commit:**
```bash
git add backend/schemas.py
git commit -m "feat: add group schemas and update LeadResponse with groups field"
```

---

## Task 3: Groups Router

**Files:**
- Create: `backend/routers/groups.py`

```python
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
    existing = db.get(LeadGroup, {"lead_id": lead_id, "group_id": group_id})
    if not existing:
        db.add(LeadGroup(lead_id=lead_id, group_id=group_id))
        db.commit()
    return {"ok": True}


@router.delete("/{group_id}/leads/{lead_id}")
def remove_lead_from_group(group_id: str, lead_id: str, db: Session = Depends(get_db)):
    junction = db.get(LeadGroup, {"lead_id": lead_id, "group_id": group_id})
    if junction:
        db.delete(junction)
        db.commit()
    return {"ok": True}
```

Verify:
```bash
cd /Users/affanzahir/code/scrapper
backend/venv/bin/python3 -c "
import sys; sys.path.insert(0,'.')
from backend.routers.groups import router
print('Routes:', [r.path for r in router.routes])
"
```

**Commit:**
```bash
git add backend/routers/groups.py
git commit -m "feat: add groups CRUD router with lead add/remove endpoints"
```

---

## Task 4: Update Leads Router + Register Groups in main.py

**Files:**
- Modify: `backend/routers/leads.py` — add `group_id` filter
- Modify: `backend/main.py` — register groups router

**Step 1: Update `list_leads` in backend/routers/leads.py**

Find the `list_leads` function signature and add `group_id` filter:

```python
@router.get("", response_model=List[LeadResponse])
def list_leads(
    job_id: Optional[str] = None,
    group_id: Optional[str] = None,   # ← add this param
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
    if group_id:                                         # ← add this block
        from ..models import LeadGroup
        q = q.join(LeadGroup, Lead.id == LeadGroup.lead_id).filter(
            LeadGroup.group_id == group_id
        )
    if status:
        q = q.filter(Lead.status == status)
    sort_col = getattr(Lead, sort_by, Lead.created_at)
    q = q.order_by(desc(sort_col) if sort_dir == "desc" else asc(sort_col))
    return q.offset(offset).limit(limit).all()
```

**Step 2: Add groups router to backend/main.py**

After `from .routers import jobs, leads`, add:
```python
from .routers import jobs, leads, groups
```

After `app.include_router(leads.router)`, add:
```python
app.include_router(groups.router)
```

**Step 3: Verify backend starts and groups routes appear**

```bash
cd /Users/affanzahir/code/scrapper/backend
source venv/bin/activate
python3 -m uvicorn backend.main:app --port 8000 --timeout-keep-alive 3 &
PID=$!
sleep 4
curl -s http://localhost:8000/api/groups
curl -s http://localhost:8000/openapi.json | python3 -c "
import sys,json; d=json.load(sys.stdin)
group_paths = [p for p in d['paths'] if 'group' in p]
print('Group routes:', group_paths)
"
kill $PID 2>/dev/null
```

Expected: `[]` and group routes listed.

**Commit:**
```bash
cd /Users/affanzahir/code/scrapper
git add backend/routers/leads.py backend/main.py backend/routers/groups.py
git commit -m "feat: register groups router, add group_id filter to leads endpoint"
```

---

## Task 5: Frontend — Update API Client

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/lib/types.ts`

**Add to types.ts:**

```typescript
export interface Group {
  id: string;
  name: string;
  color: string;
  lead_count: number;
}
```

**Update Lead interface** — add `groups` field:
```typescript
  groups?: Group[];
```

**Update list params** in api.ts — add `group_id` to leads.list:
```typescript
    list: (params?: { job_id?: string; status?: string; group_id?: string }) => { ... }
```

**Add groups API** to api.ts:
```typescript
  groups: {
    list: () => apiFetch<Group[]>("/api/groups"),
    create: (name: string, color: string) =>
      apiFetch<Group>("/api/groups", { method: "POST", body: JSON.stringify({ name, color }) }),
    update: (id: string, data: { name?: string; color?: string }) =>
      apiFetch<Group>(`/api/groups/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<{ ok: boolean }>(`/api/groups/${id}`, { method: "DELETE" }),
    addLead: (groupId: string, leadId: string) =>
      apiFetch<{ ok: boolean }>(`/api/groups/${groupId}/leads/${leadId}`, { method: "POST" }),
    removeLead: (groupId: string, leadId: string) =>
      apiFetch<{ ok: boolean }>(`/api/groups/${groupId}/leads/${leadId}`, { method: "DELETE" }),
  },
```

**Commit:**
```bash
git add frontend/lib/types.ts frontend/lib/api.ts
git commit -m "feat: add Group type and groups API client methods"
```

---

## Task 6: Frontend — GroupsSidebar Component

**Files:**
- Create: `frontend/components/GroupsSidebar.tsx`

```tsx
"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { api } from "@/lib/api";
import { Group } from "@/lib/types";

const PRESET_COLORS = [
  "#0369A1", "#0891B2", "#059669", "#D97706",
  "#DC2626", "#7C3AED", "#DB2777", "#64748B",
];

interface Props {
  groups: Group[];
  selectedGroupId: string | null;
  onSelectGroup: (id: string | null) => void;
  onGroupsChanged: (groups: Group[]) => void;
}

export function GroupsSidebar({ groups, selectedGroupId, onSelectGroup, onGroupsChanged }: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const group = await api.groups.create(newName.trim(), newColor);
    onGroupsChanged([...groups, group]);
    setNewName("");
    setNewColor(PRESET_COLORS[0]);
    setCreating(false);
  };

  const handleDelete = async (group: Group) => {
    if (!confirm(`Delete group "${group.name}"? Leads will not be deleted.`)) return;
    await api.groups.delete(group.id);
    onGroupsChanged(groups.filter(g => g.id !== group.id));
    if (selectedGroupId === group.id) onSelectGroup(null);
  };

  const handleRename = async (group: Group) => {
    if (!editName.trim()) return;
    const updated = await api.groups.update(group.id, { name: editName.trim() });
    onGroupsChanged(groups.map(g => g.id === group.id ? { ...g, name: updated.name } : g));
    setEditingId(null);
  };

  return (
    <div className="w-56 shrink-0 space-y-1">
      <div className="flex items-center justify-between px-2 mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Groups</span>
        <button
          onClick={() => setCreating(true)}
          className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          title="New group"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* All Leads */}
      <button
        onClick={() => onSelectGroup(null)}
        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
          selectedGroupId === null
            ? "bg-slate-100 text-slate-900 font-medium"
            : "text-slate-600 hover:bg-slate-50"
        }`}
      >
        <span>All Leads</span>
        <span className="text-xs text-slate-400 font-mono">
          {groups.reduce((s, g) => s, 0)}
        </span>
      </button>

      {/* Group list */}
      {groups.map((group) => (
        <div key={group.id} className="group/item relative">
          {editingId === group.id ? (
            <div className="flex items-center gap-1 px-2 py-1">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
              <input
                autoFocus
                className="flex-1 text-sm border border-sky-300 rounded px-1.5 py-0.5 focus:outline-none min-w-0"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleRename(group); if (e.key === "Escape") setEditingId(null); }}
              />
              <button onClick={() => handleRename(group)} className="p-0.5 text-emerald-600 hover:text-emerald-800">
                <Check className="w-3 h-3" />
              </button>
              <button onClick={() => setEditingId(null)} className="p-0.5 text-slate-400 hover:text-slate-600">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onSelectGroup(selectedGroupId === group.id ? null : group.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedGroupId === group.id
                  ? "bg-slate-100 text-slate-900 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                <span className="truncate">{group.name}</span>
              </div>
              <span className="text-xs text-slate-400 font-mono shrink-0 ml-1">{group.lead_count}</span>
            </button>
          )}
          {editingId !== group.id && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover/item:flex items-center gap-0.5 bg-white rounded shadow-sm border border-slate-100 px-1">
              <button
                onClick={e => { e.stopPropagation(); setEditingId(group.id); setEditName(group.name); }}
                className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleDelete(group); }}
                className="p-1 text-slate-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Create form */}
      {creating && (
        <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-white shadow-sm">
          <input
            autoFocus
            placeholder="Group name..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
            className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <div className="flex gap-1.5 flex-wrap">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-5 h-5 rounded-full transition-transform ${newColor === c ? "scale-125 ring-2 ring-offset-1 ring-slate-400" : "hover:scale-110"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="flex-1 text-xs py-1.5 bg-[#0369A1] text-white rounded-md hover:bg-sky-700 disabled:opacity-40 transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => { setCreating(false); setNewName(""); }}
              className="text-xs px-3 py-1.5 border border-slate-200 rounded-md text-slate-500 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Commit:**
```bash
git add frontend/components/GroupsSidebar.tsx
git commit -m "feat: add GroupsSidebar component with create/rename/delete/color picker"
```

---

## Task 7: Update LeadsTable — Group Badges + Add to Group

**Files:**
- Modify: `frontend/components/LeadsTable.tsx`

Add `groups` and `allGroups` to Props:
```typescript
interface Props {
  leads: Lead[];
  jobId?: string;
  allGroups: Group[];
  onLeadUpdated: (lead: Lead) => void;
  onGroupsChanged: (groups: Group[]) => void;
}
```

Add group badge column between "Size" and "Status":
- Show colored dot badges for each group the lead belongs to
- "＋" button opens a dropdown to add/remove from groups

Add this column header: `"Groups"` (after Size, before Status).

Add this cell per row:
```tsx
<td className="px-4 py-3">
  <div className="flex items-center gap-1 flex-wrap">
    {(lead.groups ?? []).map(g => (
      <button
        key={g.id}
        onClick={() => handleRemoveFromGroup(lead, g.id)}
        title={`Remove from ${g.name}`}
        className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border transition-all hover:opacity-70"
        style={{ borderColor: g.color, color: g.color, backgroundColor: g.color + "15" }}
      >
        {g.name}
        <X className="w-2.5 h-2.5" />
      </button>
    ))}
    {/* Add to group dropdown */}
    <div className="relative group/add">
      <button className="w-5 h-5 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-sky-400 hover:text-sky-600 transition-colors">
        <Plus className="w-3 h-3" />
      </button>
      <div className="absolute left-0 top-6 z-20 hidden group-hover/add:block bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[140px]">
        {allGroups.filter(g => !(lead.groups ?? []).some(lg => lg.id === g.id)).map(g => (
          <button
            key={g.id}
            onClick={() => handleAddToGroup(lead, g.id)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
            {g.name}
          </button>
        ))}
        {allGroups.filter(g => !(lead.groups ?? []).some(lg => lg.id === g.id)).length === 0 && (
          <span className="px-3 py-2 text-xs text-slate-400 block">No more groups</span>
        )}
      </div>
    </div>
  </div>
</td>
```

Add handlers:
```typescript
const handleAddToGroup = async (lead: Lead, groupId: string) => {
  await api.groups.addLead(groupId, lead.id);
  const group = allGroups.find(g => g.id === groupId)!;
  const updated = { ...lead, groups: [...(lead.groups ?? []), { id: group.id, name: group.name, color: group.color }] };
  onLeadUpdated(updated);
  onGroupsChanged(allGroups.map(g => g.id === groupId ? { ...g, lead_count: g.lead_count + 1 } : g));
};

const handleRemoveFromGroup = async (lead: Lead, groupId: string) => {
  await api.groups.removeLead(groupId, lead.id);
  const updated = { ...lead, groups: (lead.groups ?? []).filter(g => g.id !== groupId) };
  onLeadUpdated(updated);
  onGroupsChanged(allGroups.map(g => g.id === groupId ? { ...g, lead_count: Math.max(0, g.lead_count - 1) } : g));
};
```

**Commit:**
```bash
git add frontend/components/LeadsTable.tsx
git commit -m "feat: add group badges and add-to-group dropdown to leads table"
```

---

## Task 8: Update Leads Page — Sidebar Layout

**Files:**
- Modify: `frontend/app/leads/page.tsx`

Wrap content in a flex layout with `GroupsSidebar` on the left:

```tsx
"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { LeadsTable } from "@/components/LeadsTable";
import { GroupsSidebar } from "@/components/GroupsSidebar";
import { api } from "@/lib/api";
import { Lead, Group } from "@/lib/types";

function LeadsContent() {
  const params = useSearchParams();
  const router = useRouter();
  const jobId = params.get("job_id") ?? undefined;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.leads.list({ job_id: jobId }),
      api.groups.list(),
    ]).then(([leadsData, groupsData]) => {
      setLeads(leadsData);
      setGroups(groupsData);
      setLoading(false);
    });
  }, [jobId]);

  // Re-fetch when group filter changes
  useEffect(() => {
    api.leads.list({ job_id: jobId, group_id: selectedGroupId ?? undefined })
      .then(setLeads);
  }, [selectedGroupId, jobId]);

  const handleUpdated = (updated: Lead) =>
    setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));

  return (
    <main className="max-w-[1400px] mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            {selectedGroupId ? groups.find(g => g.id === selectedGroupId)?.name ?? "Group" : jobId ? "Job Results" : "All Leads"}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {selectedGroupId ? "Leads in this group" : jobId ? "Leads from this scrape job" : "All collected leads"}
          </p>
        </div>
        <div className="flex gap-2">
          {jobId && (
            <button onClick={() => router.push("/leads")}
              className="text-sm text-slate-500 hover:text-slate-900 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-white transition-all">
              View All
            </button>
          )}
          <button onClick={() => router.push("/")}
            className="text-sm font-medium text-white bg-[#0369A1] hover:bg-sky-700 px-3 py-1.5 rounded-lg transition-colors">
            + New Search
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        <GroupsSidebar
          groups={groups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={setSelectedGroupId}
          onGroupsChanged={setGroups}
        />
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-sm">Loading leads...</div>
          ) : (
            <LeadsTable
              leads={leads}
              jobId={jobId}
              allGroups={groups}
              onLeadUpdated={handleUpdated}
              onGroupsChanged={setGroups}
            />
          )}
        </div>
      </div>
    </main>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400 text-sm">Loading...</div>}>
      <LeadsContent />
    </Suspense>
  );
}
```

**Run build to verify:**
```bash
cd /Users/affanzahir/code/scrapper/frontend
npm run build 2>&1 | tail -20
```

**Commit:**
```bash
cd /Users/affanzahir/code/scrapper
git add frontend/app/leads/page.tsx
git commit -m "feat: add groups sidebar to leads page with group filter support"
```
