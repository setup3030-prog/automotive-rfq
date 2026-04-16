"""
RFQ calculation router.

POST /api/v1/rfq/calculate
    Accepts RFQ parameters and returns full analysis in one call.
    Pipeline: cost → pricing → risk → decision → sensitivity → recommendations
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from io import BytesIO

from app.schemas.rfq import RFQInput, RFQAnalysis, PDFExportRequest, CompetitorAnalysisRequest, CompetitorAnalysisResponse
from app.services.calculation import calculate_costs
from app.services.pricing import calculate_pricing
from app.services.risk import calculate_risk
from app.services.decision import calculate_decision
from app.services.sensitivity import run_sensitivity_analysis
from app.services.recommendations import generate_recommendations
from app.services.pdf_export import generate_quote_pdf
from app.services.competitor_ai import run_competitor_analysis

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


@router.post(
    "/export-pdf",
    summary="Export RFQ quote as PDF",
    description=(
        "Accepts pre-calculated RFQ data from the frontend and returns a "
        "professional A4 PDF quote document."
    ),
    response_class=StreamingResponse,
)
def export_pdf(payload: PDFExportRequest) -> StreamingResponse:
    try:
        pdf_bytes = generate_quote_pdf(payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF generation error: {exc}")

    rfq_slug = (payload.rfq_name or "quote").replace(" ", "_")[:40]
    filename = f"RFQ_{rfq_slug}.pdf"

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/competitor-analysis",
    response_model=CompetitorAnalysisResponse,
    summary="AI competitor price estimation",
    description=(
        "Sends technical RFQ parameters to Claude AI, which estimates "
        "unit selling prices for competitors from DE, CZ, SK, RO using "
        "typical injection molding benchmark rates per country. "
        "Requires ANTHROPIC_API_KEY environment variable."
    ),
)
def competitor_analysis(req: CompetitorAnalysisRequest) -> CompetitorAnalysisResponse:
    try:
        return run_competitor_analysis(req)
    except ValueError as exc:
        # Missing API key
        raise HTTPException(status_code=503, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
