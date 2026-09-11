from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.energy.router import router as energy_router
from backend.maintenance.router import router as maintenance_router
from backend.occupancy.router import router as occupancy_router
from backend.models import Facility

PROJECT_ROOT = Path(__file__).resolve().parent.parent

app = FastAPI(title="Agentic FacilityOps AI Platform")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(energy_router)
app.include_router(maintenance_router)
app.include_router(occupancy_router)

app.mount("/static", StaticFiles(directory=PROJECT_ROOT / "backend" / "static"), name="static")
templates = Jinja2Templates(directory=PROJECT_ROOT / "backend" / "templates")


# ---- JSON API ----------------------------------------------------------

@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as exc:  # noqa: BLE001 - surface any DB error plainly
        db_status = f"error: {exc}"
    return {"status": "ok", "database": db_status}


@app.get("/api/facilities")
def list_facilities(limit: int = 20, db: Session = Depends(get_db)):
    facilities = db.query(Facility).limit(limit).all()
    return [
        {
            "facility_id": f.facility_id,
            "facility_type": f.facility_type,
            "total_area_sqft": f.total_area_sqft,
            "total_floors": f.total_floors,
        }
        for f in facilities
    ]


# ---- HTML pages ---------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
def home_page(request: Request, db: Session = Depends(get_db)):
    facility_count = db.query(Facility).count()
    facilities = db.query(Facility).limit(50).all()
    return templates.TemplateResponse(request, "home.html", {
        "active": "home",
        "facility_count": facility_count,
        "facilities": facilities,
    })


@app.get("/energy", response_class=HTMLResponse)
def energy_page(request: Request):
    return templates.TemplateResponse(request, "energy.html", {"active": "energy"})


@app.get("/maintenance", response_class=HTMLResponse)
def maintenance_page(request: Request):
    return templates.TemplateResponse(request, "maintenance.html", {"active": "maintenance"})


@app.get("/occupancy", response_class=HTMLResponse)
def occupancy_page(request: Request):
    return templates.TemplateResponse(request, "occupancy.html", {"active": "occupancy"})
