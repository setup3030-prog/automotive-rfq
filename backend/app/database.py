"""
Database engine and session configuration.
SQLite for MVP — swap DATABASE_URL for PostgreSQL in production.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./rfq_quotes.db")

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
