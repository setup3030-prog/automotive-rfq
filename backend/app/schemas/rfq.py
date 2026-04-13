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
