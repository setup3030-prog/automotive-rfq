"""
RFQ calculation router.

POST /api/v1/rfq/calculate
    Accepts RFQ parameters and returns full analysis in one call.
    Pipeline: cost → pricing → risk → decision → sensitivity → recommendations
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

from app.schemas.rfq import RFQInput, RFQAnalysis
from app.services.calculation import calculate_costs
from app.services.pricing import calculate_pricing
from app.services.risk import calculate_risk
from app.services.decision import calculate_decision
from app.services.sensitivity import run_sensitivity_analysis
from app.services.recommendations import generate_recommendations

router = APIRouter()


@router.post(
    "/calculate",
    response_model=RFQAnalysis,
    summary="Run complete RFQ analysis",
    description=(
        "Accepts injection molding parameters and returns a full decision package: "
        "cost breakdown, 3-tier pricing, risk assessment, GO/NO GO decision, "
        "6-scenario sensitivity analysis, and prioritized improvement recommendations."
    ),
)
def calculate_rfq(inp: RFQInput) -> RFQAnalysis:
    try:
        costs = calculate_costs(inp)
        pricing = calculate_pricing(costs.total_cost_per_part)
        risk = calculate_risk(inp)
        decision = calculate_decision(costs.total_cost_per_part, pricing, risk)
        sensitivity = run_sensitivity_analysis(inp, costs.total_cost_per_part)
        recommendations = generate_recommendations(inp, costs.total_cost_per_part, risk)

        return RFQAnalysis(
            rfq_name=inp.rfq_name,
            customer=inp.customer,
            part_number=inp.part_number,
            costs=costs,
            pricing=pricing,
            risk=risk,
            decision=decision,
            sensitivity=sensitivity,
            recommendations=recommendations,
            timestamp=datetime.now(timezone.utc),
        )

    except ZeroDivisionError:
        raise HTTPException(
            status_code=422,
            detail="Division by zero detected — verify OEE > 0, cycle_time > 0, annual_volume > 0.",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Calculation error: {exc}")
