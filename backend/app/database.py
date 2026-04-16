"""
Database engine and session configuration.
SQLite for MVP — swap DATABASE_URL for PostgreSQL in production.
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# Loads backend/.env when running locally (uvicorn is started from the backend/ dir).
# No-op when env vars are already set (e.g. Vercel injects them directly).
load_dotenv()

# On Vercel the working directory is read-only; use /tmp for SQLite.
# In production set DATABASE_URL to a PostgreSQL connection string (e.g. Neon).
_default_sqlite = (
    "sqlite:////tmp/rfq_quotes.db"
    if os.getenv("VERCEL")
    else "sqlite:///./rfq_quotes.db"
)
DATABASE_URL = os.getenv("DATABASE_URL", _default_sqlite)

# SQLite requires check_same_thread=False for multi-threaded use.
# PostgreSQL does not need this argument.
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False,  # Set True for SQL query logging
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency: yields a database session and ensures cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
