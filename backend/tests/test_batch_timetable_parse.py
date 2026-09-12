"""Pure unit test: the CSV/Excel timetable parser used by
POST /batches/{id}/timetable/upload must accept well-formed rows and reject a
row missing required fields, instead of silently scheduling garbage."""
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from server import _read_timetable_rows, _parse_timetable_rows

GOOD_CSV = (
    b"title,date,time,duration_min,mode,topic\n"
    b"Intro class,2026-01-05,18:00,60,interactive,Welcome\n"
)
BAD_CSV = b"title,date,time,duration_min,mode,topic\n,2026-01-05,not-a-time,60,interactive,\n"


def test_parses_valid_csv_rows():
    rows = _read_timetable_rows(GOOD_CSV, "schedule.csv")
    items = _parse_timetable_rows(rows)
    assert items == [{
        "title": "Intro class", "starts_at": "2026-01-05T18:00:00",
        "duration_min": 60, "mode": "interactive", "topic": "Welcome",
    }]


def test_rejects_bad_row():
    rows = _read_timetable_rows(BAD_CSV, "schedule.csv")
    with pytest.raises(HTTPException) as exc:
        _parse_timetable_rows(rows)
    assert "title" in exc.value.detail and "time" in exc.value.detail


if __name__ == "__main__":
    test_parses_valid_csv_rows()
    try:
        _parse_timetable_rows(_read_timetable_rows(BAD_CSV, "schedule.csv"))
        raise SystemExit("expected HTTPException for bad row")
    except HTTPException:
        pass
    print("ok")
