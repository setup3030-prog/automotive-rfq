"""
Core injection molding cost calculation engine.

All costs are calculated per finished part and denominated in USD.

Formula chain:
    effective_cycle_time = cycle_time / (OEE / 100)
    parts_per_hour       = (3600 / effective_cycle_time) × cavities

    machine_cost    = machine_hourly_rate / parts_per_hour
    material_cost   = (shot_weight × material_price) / (1 − scrap_rate / 100)
    labor_cost      = labor_hourly_rate / parts_per_hour
    energy_cost     = energy_hourly_rate / parts_per_hour
    tool_amort      = tool_cost / annual_volume

    total_cost      = Σ all above
"""

from app.schemas.rfq import RFQInput, CostBreakdown


def calculate_costs(inp: RFQInput) -> CostBreakdown:
    """
    Calculate per-part cost breakdown from RFQ input parameters.

    OEE adjustment: machines do not run at 100% theoretical capacity.
    Effective cycle time accounts for planned and unplanned losses.

    Scrap adjustment: material cost is divided by the yield fraction so
    rejected parts are included in the cost of good parts.
    """

    # ── Throughput ─────────────────────────────────────────────────────
    # OEE < 100% means the machine produces less than theoretical max.
    # Dividing cycle time by OEE fraction gives the *effective* time per cycle.
    effective_cycle_time: float = inp.cycle_time / (inp.oee / 100.0)

    # All cavities fire simultaneously per shot.
    parts_per_hour: float = (3600.0 / effective_cycle_time) * inp.cavities

    # ── Machine cost ────────────────────────────────────────────────────
    machine_cost: float = inp.machine_hourly_rate / parts_per_hour

    # ── Material cost ───────────────────────────────────────────────────
    # Gross material consumed per part * price, then inflated by scrap rate.
    # (1 - scrap_rate/100) = yield fraction of good parts.
    yield_fraction: float = 1.0 - (inp.scrap_rate / 100.0)
    gross_material: float = inp.shot_weight * inp.material_price_per_kg
    material_cost: float = gross_material / yield_fraction

    # ── Labor cost ──────────────────────────────────────────────────────
    labor_cost: float = inp.labor_cost_per_hour / parts_per_hour

    # ── Energy cost ─────────────────────────────────────────────────────
    energy_cost: float = inp.energy_cost_per_hour / parts_per_hour

    # ── Tool amortization ───────────────────────────────────────────────
    # Simple 1-year straight-line amortization over annual volume.
    # For multi-year programs, divide tool_cost by (annual_volume × years).
    tool_amort: float = inp.tool_cost / inp.annual_volume

    # ── Total ────────────────────────────────────────────────────────────
    total: float = machine_cost + material_cost + labor_cost + energy_cost + tool_amort

    return CostBreakdown(
        effective_cycle_time=round(effective_cycle_time, 4),
        parts_per_hour=round(parts_per_hour, 3),
        machine_cost_per_part=round(machine_cost, 6),
        material_cost_per_part=round(material_cost, 6),
        labor_cost_per_part=round(labor_cost, 6),
        energy_cost_per_part=round(energy_cost, 6),
        tool_amortization_per_part=round(tool_amort, 6),
        total_cost_per_part=round(total, 6),
    )
