from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from ..database import get_db
from ..services import sheets_service

router = APIRouter(prefix="/api/sheets", tags=["sheets"])


class ImportRow(BaseModel):
    keyword: str
    location: str
    row: int
    status: str


class LocationItem(BaseModel):
    location: str
    row: int
    col: int = 0
    status: str


class GroupedRow(BaseModel):
    keyword: str
    locations: List[LocationItem]


class ImportResponse(BaseModel):
    imported: int
    skipped: int
    job_ids: List[str]


class SheetStatusResponse(BaseModel):
    connected: bool
    input_sheet_id: str
    output_sheet_id: str
    error: str | None = None


@router.get("/status", response_model=SheetStatusResponse)
def sheet_status():
    connected = sheets_service.credentials_exist()
    return SheetStatusResponse(
        connected=connected,
        input_sheet_id=sheets_service.INPUT_SHEET_ID,
        output_sheet_id=sheets_service.OUTPUT_SHEET_ID,
        error=None if connected else "credentials.json not found in backend/",
    )


@router.get("/input-rows", response_model=List[ImportRow])
def get_input_rows():
    try:
        return sheets_service.read_input_rows()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read input sheet: {e}")


@router.get("/input-rows/grouped", response_model=List[GroupedRow])
def get_input_rows_grouped():
    try:
        return sheets_service.read_input_rows_grouped()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read input sheet: {e}")


@router.post("/import", response_model=ImportResponse)
async def import_from_sheet(
    background_tasks: BackgroundTasks,
    skip_done: bool = True,
    parallel_jobs: int = 10,
):
    """
    Read the input sheet and start a single sequential orchestrator:
    - Business type 1: all locations run in parallel → all rows crossed out → next type
    - Business type 2: all locations run in parallel → all rows crossed out → next type
    - ...
    """
    try:
        groups = sheets_service.read_input_rows_grouped()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read input sheet: {e}")

    # Count what will be imported vs skipped
    imported = 0
    skipped = 0
    pending_groups = []

    for group in groups:
        pending_locs = [
            loc for loc in group["locations"]
            if not (skip_done and loc["status"].lower() == "done")
        ]
        skipped += len(group["locations"]) - len(pending_locs)
        if pending_locs:
            imported += len(pending_locs)
            # Build matrix-aware group with row + col per location
            matrix = sheets_service.read_input_matrix()
            matrix_map = {entry["keyword"]: entry for entry in matrix}
            entry = matrix_map.get(group["keyword"])
            if entry:
                locs_with_col = [
                    {"location": loc["location"], "col": loc["col"], "done": loc["done"]}
                    for loc in entry["locations"]
                    if not (skip_done and loc["done"])
                ]
                pending_groups.append({
                    "keyword": group["keyword"],
                    "row": entry["row"],
                    "locations": locs_with_col,
                })

    if pending_groups:
        from ..scraper.sheet_runner import run_sheet_batch
        background_tasks.add_task(run_sheet_batch, pending_groups, parallel_jobs)

    return ImportResponse(imported=imported, skipped=skipped, job_ids=[])
