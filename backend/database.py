import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parent.parent

load_dotenv(PROJECT_ROOT / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/facilityops.db")
if DATABASE_URL.startswith("sqlite:///") and DATABASE_URL != "sqlite:///:memory:":
    database_path = Path(DATABASE_URL.removeprefix("sqlite:///"))
    if not database_path.is_absolute():
        database_path = PROJECT_ROOT / database_path
    DATABASE_URL = f"sqlite:///{database_path}"

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
