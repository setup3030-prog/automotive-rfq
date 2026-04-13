"""
Quote history router — save and retrieve past RFQ analyses.

POST   /api/v1/quotes/       — save a quote to the database
GET    /api/v1/quotes/       — list all saved quotes (summary)
GET    /api/v1/quotes/{id}   — retrieve a specific quote (full detail)
DELETE /api/v1/quotes/{id}   — delete a saved quote
"""

import json
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Quote
from app.schemas.rfq import RFQInput, RFQAnalysis
from app.routers.rfq import calculate_rfq

router = APIRouter()


@router.post("/", summary="Save RFQ quote")
def save_quote(inp: RFQInput, db: Session = Depends(get_db)) -> dict:
    """Calculate and persist an RFQ quote to the database."""
    analysis: RFQAnalysis = calculate_rfq(inp)

    quote = Quote(
        rfq_name=inp.rfq_name,
        customer=inp.customer,
        part_number=inp.part_number,
        input_data=inp.model_dump_json(),
        result_data=analysis.model_dump_json(),
        decision=analysis.decision.decision,
        risk_level=analysis.risk.level,
        total_cost_per_part=analysis.costs.total_cost_per_part,
        target_price=analysis.pricing.target.price,
        margin_pct=analysis.decision.margin_at_aggressive_pct,
    )
    db.add(quote)
    db.commit()
    db.refresh(quote)

    return {"id": quote.id, "message": "Quote saved successfully", "rfq_name": inp.rfq_name}


@router.get("/", summary="List saved quotes")
def list_quotes(db: Session = Depends(get_db)) -> List[dict]:
    """Return summary list of all saved quotes, newest first."""
    quotes = db.query(Quote).order_by(Quote.created_at.desc()).limit(100).all()
    return [
        {
            "id": q.id,
            "rfq_name": q.rfq_name,
            "customer": q.customer,
            "part_number": q.part_number,
            "decision": q.decision,
            "risk_level": q.risk_level,
            "total_cost_per_part": q.total_cost_per_part,
            "target_price": q.target_price,
            "margin_pct": q.margin_pct,
            "created_at": q.created_at.isoformat() if q.created_at else None,
        }
        for q in quotes
    ]


@router.get("/{quote_id}", summary="Get quote detail")
def get_quote(quote_id: int, db: Session = Depends(get_db)) -> dict:
    """Retrieve full input + analysis for a specific saved quote."""
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail=f"Quote {quote_id} not found.")
    return {
        "id": quote.id,
        "rfq_name": quote.rfq_name,
        "customer": quote.customer,
        "part_number": quote.part_number,
        "input": json.loads(quote.input_data),
        "result": json.loads(quote.result_data),
        "created_at": quote.created_at.isoformat() if quote.created_at else None,
    }


@router.delete("/{quote_id}", summary="Delete a saved quote")
def delete_quote(quote_id: int, db: Session = Depends(get_db)) -> dict:
    """Permanently delete a saved quote."""
    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail=f"Quote {quote_id} not found.")
    db.delete(quote)
    db.commit()
    return {"message": f"Quote {quote_id} deleted."}
