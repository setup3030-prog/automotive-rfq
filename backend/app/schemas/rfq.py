"""
Pydantic schemas for all RFQ input/output data structures.
"""

from __future__ import annotations
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────
# INPUT
# ─────────────────────────────────────────────

class RFQInput(BaseModel):
    """All parameters required to calculate an injection molding RFQ."""

    # Identification
    rfq_name: str = Field(default="New RFQ", max_length=200, description="RFQ identifier")
    customer: Optional[str] = Field(default=None, max_length=200, description="Customer name")
    part_number: Optional[str] = Field(default=None, max_length=100, description="Part number")

    # Production
    cycle_time: float = Field(
        gt=0, description="Injection molding cycle time per shot (seconds)"
    )
    cavities: int = Field(
        ge=1, le=64, description="Number of cavities in the mold"
    )
    oee: float = Field(
        ge=1.0, le=99.9,
        description="Overall Equipment Effectiveness — production efficiency (%)"
    )

    # Material
    material_price_per_kg: float = Field(
        gt=0, description="Raw material price per kilogram ($)"
    )
    shot_weight: float = Field(
        gt=0, description="Material weight consumed per finished part (kg)"
    )
    scrap_rate: float = Field(
        ge=0.0, le=50.0, description="Reject / scrap rate (%)"
    )

    # Business
    annual_volume: int = Field(
        gt=0, description="Annual production commitment (parts/year)"
    )
    tool_cost: float = Field(
        ge=0.0, description="Total tooling investment to amortize ($)"
    )
    machine_hourly_rate: float = Field(
        gt=0, description="Machine running cost ($/hour)"
    )
    labor_cost_per_hour: float = Field(
        ge=0.0, description="Direct labor cost per machine ($/hour)"
    )
    energy_cost_per_hour: float = Field(
        ge=0.0, description="Energy / utilities per machine ($/hour)"
    )


# ─────────────────────────────────────────────
# COST BREAKDOWN
# ─────────────────────────────────────────────

class CostBreakdown(BaseModel):
    """Per-part cost breakdown and production throughput metrics."""

    # Throughput
    effective_cycle_time: float   # seconds (cycle_time / OEE)
    parts_per_hour: float

    # Cost components — all in $ per part
    machine_cost_per_part: float
    material_cost_per_part: float
    labor_cost_per_part: float
    energy_cost_per_part: float
    tool_amortization_per_part: float
    total_cost_per_part: float


# ─────────────────────────────────────────────
# PRICING
# ─────────────────────────────────────────────

class PriceLevel(BaseModel):
    label: str
    price: float
    margin_pct: float
    description: str


class PricingResult(BaseModel):
    """Three-tier negotiation pricing strategy."""
    walk_away: PriceLevel    # 5% minimum margin floor
    aggressive: PriceLevel   # 9% competitive bid
    target: PriceLevel       # 15% open negotiation anchor


# ─────────────────────────────────────────────
# RISK
# ─────────────────────────────────────────────

class RiskFactor(BaseModel):
    category: str   # OEE | SCRAP | VOLUME
    severity: str   # LOW | MEDIUM | HIGH
    message: str


class RiskResult(BaseModel):
    level: str        # LOW | MEDIUM | HIGH
    score: int        # Raw numeric risk score
    factors: List[RiskFactor]


# ─────────────────────────────────────────────
# DECISION
# ─────────────────────────────────────────────

class DecisionResult(BaseModel):
    decision: str                    # GO | NO GO
    margin_at_aggressive_pct: float  # Margin if quoting at aggressive price
    margin_at_target_pct: float      # Margin if quoting at target price
    reasons: List[str]               # Primary GO/NO GO justifications
    alerts: List[str]                # Warnings for GO decisions


# ─────────────────────────────────────────────
# SENSITIVITY
# ─────────────────────────────────────────────

class SensitivityScenario(BaseModel):
    parameter: str
    change_description: str
    new_cost_per_part: float
    cost_delta: float          # positive = cost increase, negative = cost decrease
    cost_delta_pct: float      # % change in total cost
    new_margin_at_aggressive_pct: float
    margin_delta_pct: float    # pp change in margin (positive = better)
    impact_level: str          # LOW | MEDIUM | HIGH


# ─────────────────────────────────────────────
# RECOMMENDATIONS
# ─────────────────────────────────────────────

class Recommendation(BaseModel):
    priority: int
    category: str                  # CYCLE_TIME | OEE | SCRAP | TOOLING | MATERIAL
    title: str
    action: str
    expected_savings: float        # $ per part saved
    margin_improvement_pct: float  # pp margin gain at current bid price
    impact: str                    # LOW | MEDIUM | HIGH
    rationale: str


# ─────────────────────────────────────────────
# TOP-LEVEL RESPONSE
# ─────────────────────────────────────────────

class RFQAnalysis(BaseModel):
    """Complete RFQ analysis — returned by POST /api/v1/rfq/calculate"""

    rfq_name: str
    customer: Optional[str]
    part_number: Optional[str]

    costs: CostBreakdown
    pricing: PricingResult
    risk: RiskResult
    decision: DecisionResult
    sensitivity: List[SensitivityScenario]
    recommendations: List[Recommendation]

    timestamp: datetime


# ─────────────────────────────────────────────
# PDF EXPORT REQUEST
# ─────────────────────────────────────────────

class PDFExportRequest(BaseModel):
    """Payload sent by frontend to generate a PDF quote. Accepts pre-calculated values."""

    # Identification
    rfq_name: str = Field(default="New RFQ", max_length=200)
    customer: Optional[str] = None
    part_number: Optional[str] = None
    part_description: Optional[str] = None
    quoting_engineer: Optional[str] = None
    rfq_date: Optional[str] = None
    currency: str = "PLN"

    # Key process parameters (for display on PDF)
    annual_volume: int = Field(gt=0)
    cycle_time_s: float = Field(gt=0, description="Cycle time in seconds")
    cavities: int = Field(ge=1)
    oee_pct: float = Field(ge=0, le=100, description="OEE as percentage, e.g. 82.0")
    scrap_rate_pct: float = Field(ge=0, le=50, description="Scrap rate as percentage, e.g. 3.5")

    # Pre-calculated cost breakdown (per part, in selected currency)
    machine_cost: float = Field(ge=0, default=0)
    material_cost: float = Field(ge=0, default=0)
    tooling_cost: float = Field(ge=0, default=0)
    labor_cost: float = Field(ge=0, default=0)
    energy_cost: float = Field(ge=0, default=0)
    overhead_cost: float = Field(ge=0, default=0)
    logistics_packaging: float = Field(ge=0, default=0)
    total_cost: float = Field(gt=0)

    # Pricing strategy
    walk_away_price: float = Field(ge=0)
    target_price_calc: float = Field(ge=0)
    aggressive_price: float = Field(ge=0)
    walk_away_margin: float = Field(description="Fraction 0–1")
    target_margin: float = Field(description="Fraction 0–1")
    aggressive_margin: float = Field(description="Fraction 0–1")

    # Customer info
    customer_target_price: Optional[float] = None

    # Decision summary
    decision: str = Field(default="-")


# ─────────────────────────────────────────────
# COMPETITOR ANALYSIS (AI)
# ─────────────────────────────────────────────

class CompetitorAnalysisRequest(BaseModel):
    """Technical RFQ parameters sent to AI for competitor price estimation."""

    cycle_time_s: float = Field(gt=0, description="Cycle time per shot (seconds)")
    cavities: int = Field(ge=1, le=64)
    oee_pct: float = Field(ge=1, le=99, description="OEE as percentage, e.g. 82.0")
    shot_weight_kg: float = Field(gt=0, description="Material weight per part (kg)")
    material_grade: Optional[str] = Field(default=None, max_length=100)
    material_price_eur: float = Field(gt=0, description="Material price in EUR/kg")
    annual_volume: int = Field(gt=0)
    tool_cost_eur: float = Field(ge=0, description="Tooling cost in EUR")
    eur_rate: float = Field(default=1.0, gt=0, description="Local currency units per 1 EUR")
    scrap_rate_pct: float = Field(ge=0, le=50, default=3.0, description="Scrap rate as percentage, e.g. 3.5")


class CountryEstimate(BaseModel):
    """AI-estimated competitor pricing for one country."""

    country: str
    code: str                   # ISO-2: DE, CZ, SK, RO
    machine_rate_eur: float
    labor_rate_eur: float
    energy_rate_eur: float
    est_cost_eur: float
    est_price_low_eur: float
    est_price_high_eur: float
    rationale: str


class CompetitorAnalysisResponse(BaseModel):
    """Response from AI competitor analysis endpoint."""

    countries: List[CountryEstimate]
    summary: str
