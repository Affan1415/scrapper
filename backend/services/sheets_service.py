import os
from dotenv import load_dotenv
load_dotenv()

INPUT_SHEET_ID = os.getenv("INPUT_SHEET_ID", "1ki9gdKF6sOfQQ9g5UVlgftClKe5wqYyBgJ9u3VGLGVs")
OUTPUT_SHEET_ID = os.getenv("OUTPUT_SHEET_ID", "1wJkjHwd3k6vonzSdKR6NIO5V_O7-GEVA4faJuBmlfeM")
CREDS_ENV = os.getenv("GOOGLE_CREDENTIALS_PATH", "credentials.json")

OUTPUT_HEADERS = [
    "Business Name", "Category", "Location", "Address", "Phone",
    "Email", "Website", "Rating", "Reviews", "Size", "Status",
    "Notes", "Google Maps URL",
]

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

# Matrix layout constants
HEADER_ROW = 2        # Row 2 has column headers (locations)
DATA_START_ROW = 3    # Business types start at row 3
LOCATION_START_COL = 2  # Locations start at column B (col index 2, 1-based)


def _creds_path() -> str:
    if os.path.isabs(CREDS_ENV):
        return CREDS_ENV
    return os.path.join(os.path.dirname(__file__), "..", CREDS_ENV)


def credentials_exist() -> bool:
    return os.path.exists(os.path.abspath(_creds_path()))


def _get_client():
    import gspread
    from google.oauth2.service_account import Credentials
    path = os.path.abspath(_creds_path())
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Google credentials not found at {path}. "
            "Place credentials.json in the backend/ directory."
        )
    creds = Credentials.from_service_account_file(path, scopes=SCOPES)
    return gspread.authorize(creds)


# ── Input sheet (matrix format) ────────────────────────────────────────────────

def read_input_matrix() -> list[dict]:
    """
    Read the matrix-format input sheet.

    Layout:
      Row 1:  Label row (skip)
      Row 2:  "Business type" | Location1 | Location2 | ... | LocationN
      Row 3+: BusinessType1   | cell      | cell      | ... | cell
              BusinessType2   | ...

    Cell values: empty = pending, any value (✓, Done, etc.) = done.

    Returns list of:
      {
        keyword: str,
        row: int,          # 1-based sheet row
        locations: [
          { location: str, col: int, done: bool }
        ]
      }
    """
    client = _get_client()
    sheet = client.open_by_key(INPUT_SHEET_ID).sheet1
    all_values = sheet.get_all_values()

    if len(all_values) < HEADER_ROW:
        return []

    # Row 2 (0-indexed: 1) = location headers
    header = all_values[HEADER_ROW - 1]
    locations = []
    for col_idx, val in enumerate(header):
        if col_idx == 0:
            continue  # skip "Business type" header
        loc = val.strip()
        if loc:
            locations.append({"location": loc, "col": col_idx + 1})  # 1-based

    result = []
    for row_idx, row in enumerate(all_values[DATA_START_ROW - 1:], start=DATA_START_ROW):
        keyword = row[0].strip() if row else ""
        if not keyword:
            continue

        type_locations = []
        for loc_info in locations:
            col_idx = loc_info["col"] - 1  # 0-based for indexing
            cell_value = row[col_idx].strip() if col_idx < len(row) else ""
            type_locations.append({
                "location": loc_info["location"],
                "col": loc_info["col"],
                "done": bool(cell_value),
                "value": cell_value,
            })

        result.append({
            "keyword": keyword,
            "row": row_idx,
            "locations": type_locations,
        })

    return result


def read_input_rows_grouped() -> list[dict]:
    """
    Convert the matrix into the grouped format used by the router and frontend:
      [{ keyword, locations: [{ location, row, col, status }] }]
    """
    matrix = read_input_matrix()
    result = []
    for entry in matrix:
        locs = []
        for loc in entry["locations"]:
            val = loc.get("value", "")
            if "✓" in val or (val and "⏳" not in val):
                status = "Done"
            elif "⏳" in val:
                status = "Running"
            else:
                status = ""
            locs.append({
                "location": loc["location"],
                "row": entry["row"],
                "col": loc["col"],
                "status": status,
            })
        result.append({"keyword": entry["keyword"], "locations": locs})
    return result


def _update_cell_with_color(row: int, col: int, value: str, bg: dict) -> None:
    """Write a value and background colour to a single cell via batchUpdate."""
    client = _get_client()
    spreadsheet = client.open_by_key(INPUT_SHEET_ID)
    sheet_id = spreadsheet.sheet1.id
    spreadsheet.batch_update({
        "requests": [
            {
                "updateCells": {
                    "range": {
                        "sheetId": sheet_id,
                        "startRowIndex": row - 1,
                        "endRowIndex": row,
                        "startColumnIndex": col - 1,
                        "endColumnIndex": col,
                    },
                    "rows": [{
                        "values": [{
                            "userEnteredValue": {"stringValue": value},
                            "userEnteredFormat": {
                                "backgroundColor": bg,
                                "horizontalAlignment": "CENTER",
                                "textFormat": {"bold": True},
                            },
                        }]
                    }],
                    "fields": "userEnteredValue,userEnteredFormat.backgroundColor,userEnteredFormat.horizontalAlignment,userEnteredFormat.textFormat.bold",
                }
            }
        ]
    })


def mark_cell_running(row: int, col: int) -> None:
    """Mark a cell as currently running (light blue background + ⏳)."""
    try:
        _update_cell_with_color(
            row, col, "⏳",
            {"red": 0.78, "green": 0.91, "blue": 0.98},  # sky-100
        )
    except Exception:
        pass


def mark_cell_done(row: int, col: int, value: str = "✓") -> None:
    """Mark a specific cell in the input sheet as done (green background + ✓)."""
    try:
        _update_cell_with_color(
            row, col, value,
            {"red": 0.78, "green": 0.94, "blue": 0.80},  # emerald-100
        )
    except Exception:
        pass


def strikethrough_row(row: int) -> None:
    """
    Apply strikethrough + grey background to an entire row in the input sheet
    to visually cross it out when all locations for a business type are done.
    """
    try:
        client = _get_client()
        spreadsheet = client.open_by_key(INPUT_SHEET_ID)
        sheet_id = spreadsheet.sheet1.id

        spreadsheet.batch_update({
            "requests": [{
                "repeatCell": {
                    "range": {
                        "sheetId": sheet_id,
                        "startRowIndex": row - 1,
                        "endRowIndex": row,
                    },
                    "cell": {
                        "userEnteredFormat": {
                            "textFormat": {"strikethrough": True},
                            "backgroundColor": {"red": 0.93, "green": 0.93, "blue": 0.93},
                        }
                    },
                    "fields": "userEnteredFormat.textFormat.strikethrough,userEnteredFormat.backgroundColor",
                }
            }]
        })
    except Exception:
        pass


# ── Output sheet ───────────────────────────────────────────────────────────────

def ensure_output_headers(sheet) -> None:
    existing = sheet.row_values(1)
    if not existing:
        sheet.append_row(OUTPUT_HEADERS, value_input_option="USER_ENTERED")


def append_leads_to_output(leads: list, job_location: str) -> int:
    """Append scraped leads to the output sheet. Returns rows written."""
    if not leads:
        return 0

    client = _get_client()
    sheet = client.open_by_key(OUTPUT_SHEET_ID).sheet1
    ensure_output_headers(sheet)

    rows = []
    for lead in leads:
        rows.append([
            lead.business_name or "",
            lead.category or "",
            job_location,
            lead.address or "",
            ("'" + lead.phone) if lead.phone else "",
            lead.email or "",
            lead.website or "",
            float(lead.rating) if lead.rating is not None else "",
            int(lead.review_count) if lead.review_count is not None else "",
            lead.business_size_tier.value if lead.business_size_tier else "",
            "",
            lead.notes or "",
            lead.google_maps_url or "",
        ])

    if rows:
        sheet.append_rows(rows, value_input_option="USER_ENTERED")

    return len(rows)
