"""
Sensitivity analysis engine.

Tests how changes in key parameters affect total cost and margin.
Each scenario modifies one input at a time (all else equal).

Scenarios:
    1. Cycle time +10%
    2. Scrap rate +5 percentage points
    3. Annual volume -20%
    4. Annual volume +20%
    5. Material price +15%
    6. OEE -10 percentage points
"""

from typing import List
from app.schemas.rfq import RFQInput, SensitivityScenario
from app.services.calculation import calculate_costs

AGGRESSIVE_MARGIN = 0.09  # Must match pricing.py


def _base_aggressive_price(base_cost: float) -> float:
    return base_cost / (1.0 - AGGRESSIVE_MARGIN)


def _scenario(
    parameter: str,
    description: str,
    modified: RFQInput,
    base_cost: float,
    fixed_price: float,
) -> SensitivityScenario:
    """Compute one sensitivity scenario and return structured result."""
    new_costs = calculate_costs(modified)
    new_cost = new_costs.total_cost_per_part

    cost_delta = new_cost - base_cost
    cost_delta_pct = (cost_delta / base_cost) * 100.0

    # Margin at the FIXED aggressive price (what was originally quoted)
    new_margin = ((fixed_price - new_cost) / fixed_price) * 100.0
    base_margin = 9.0  # by definition at aggressive price
    margin_delta = new_margin - base_margin

    abs_delta_pct = abs(cost_delta_pct)
    impact = "HIGH" if abs_delta_pct > 10 else ("MEDIUM" if abs_delta_pct > 4 else "LOW")

    return SensitivityScenario(
        parameter=parameter,
        change_description=description,
        new_cost_per_part=round(new_cost, 6),
        cost_delta=round(cost_delta, 6),
        cost_delta_pct=round(cost_delta_pct, 2),
        new_margin_at_aggressive_pct=round(new_margin, 2),
        margin_delta_pct=round(margin_delta, 2),
        impact_level=impact,
    )


def run_sensitivity_analysis(
    base_input: RFQInput,
    base_cost: float,
) -> List[SensitivityScenario]:
    """Run all sensitivity scenarios against the base RFQ input."""

    fixed_price = _base_aggressive_price(base_cost)
    results: List[SensitivityScenario] = []

    # 1. Cycle time +10%
    new_ct = round(base_input.cycle_time * 1.10, 2)
    results.append(_scenario(
        "Cycle Time +10%",
        f"Cycle time: {base_input.cycle_time:.1f}s to {new_ct:.1f}s",
        base_input.model_copy(update={"cycle_time": new_ct}),
        base_cost, fixed_price,
    ))

    # 2. Scrap rate +5 pp
    new_scrap = min(base_input.scrap_rate + 5.0, 49.0)
    results.append(_scenario(
        "Scrap Rate +5pp",
        f"Scrap: {base_input.scrap_rate:.1f}% to {new_scrap:.1f}%",
        base_input.model_copy(update={"scrap_rate": new_scrap}),
        base_cost, fixed_price,
    ))

    # 3. Volume -20%
    new_vol_down = max(int(base_input.annual_volume * 0.80), 1)
    results.append(_scenario(
        "Volume -20%",
        f"Volume: {base_input.annual_volume:,} to {new_vol_down:,} parts/yr",
        base_input.model_copy(update={"annual_volume": new_vol_down}),
        base_cost, fixed_price,
    ))

    # 4. Volume +20%
    new_vol_up = int(base_input.annual_volume * 1.20)
    results.append(_scenario(
        "Volume +20%",
        f"Volume: {base_input.annual_volume:,} to {new_vol_up:,} parts/yr",
        base_input.model_copy(update={"annual_volume": new_vol_up}),
        base_cost, fixed_price,
    ))

    # 5. Material price +15%
    new_mat = round(base_input.material_price_per_kg * 1.15, 4)
    results.append(_scenario(
        "Material +15%",
        f"Material: ${base_input.material_price_per_kg:.2f}/kg to ${new_mat:.2f}/kg",
        base_input.model_copy(update={"material_price_per_kg": new_mat}),
        base_cost, fixed_price,
    ))

    # 6. OEE -10 pp
    new_oee = max(base_input.oee - 10.0, 20.0)
    results.append(_scenario(
        "OEE -10pp",
        f"OEE: {base_input.oee:.1f}% to {new_oee:.1f}%",
        base_input.model_copy(update={"oee": new_oee}),
        base_cost, fixed_price,
    ))

    return results
