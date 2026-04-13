"""
Automotive Injection Molding RFQ System — FastAPI Application
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import rfq, quotes

# Create all database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Automotive RFQ Engine",
    description=(
        "Production-ready RFQ quoting and cost calculation system for "
        "automotive injection molding. Includes cost breakdown, 3-tier pricing, "
        "risk assessment, GO/NO GO decision, sensitivity analysis, and recommendations."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "https://automotive-frontend.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rfq.router, prefix="/api/v1/rfq", tags=["RFQ Calculation"])
app.include_router(quotes.router, prefix="/api/v1/quotes", tags=["Quote History"])


@app.get("/", tags=["Health"])
def root():
    return {
        "service": "Automotive RFQ Engine",
        "version": "1.0.0",
        "status": "operational",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}
