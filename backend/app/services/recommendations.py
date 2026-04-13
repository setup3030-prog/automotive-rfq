"""
Recommendation engine — identifies and prioritizes actions to improve margin.

For each candidate improvement, calculates:
    - Cost savings per part (absolute $)
    - Margin improvement at the FIXED aggressive bid price (pp)

The fixed-price approach answers the practical question:
    "If we improve our process but keep the same bid price, how much better is our margin?"

Top 5 improvements are returned, sorted by savings impact.
"""

from typing import List
from app.schemas.rfq import RFQInput, RiskResult, Recommendation
from app.services.calculation import calculate_costs

AGGRESSIVE_MARGIN = 0.09


def _margin_at_fixed_price(new_cost: float, fixed_price: float) -> float:
    """Margin percentage at a fixed bid price."""
    return ((fixed_price - new_cost) / fixed_price) * 100.0


def generate_recommendations(
    base_input: RFQInput,
    base_cost: float,
    risk: RiskResult,
) -> List[Recommendation]:
    """
    Generate prioritized list of process improvement recommendations.

    Args:
        base_input: Original RFQ parameters
        base_cost:  Total cost per part at base parameters
        risk:       Risk assessment (used for risk-specific recommendations)

    Returns:
        Up to 5 Recommendation objects, sorted by expected savings (highest first)
    """
    fixed_price = base_cost / (1.0 - AGGRESSIVE_MARGIN)
    base_margin = 9.0  # definition

    candidates: list[tuple[float, Recommendation]] = []

    def _add(
        category: str,
        title: str,
        action: str,
        rationale: str,
        modified: RFQInput,
    ) -> None:
        new_cost = calculate_costs(modified).total_cost_per_part
        savings = base_cost - new_cost
        if savings <= 0:
            return
        new_margin = _margin_at_fixed_price(new_cost, fixed_price)
        margin_pp = new_margin - base_margin
        impact = "HIGH" if savings / base_cost > 0.07 else ("MEDIUM" if savings / base_cost > 0.03 else "LOW")
        candidates.append((savings, Recommendation(
            priority=0,
            category=category,
            title=title,
            action=action,
            expected_savings=round(savings, 6),
            margin_improvement_pct=round(margin_pp, 2),
            impact=impact,
            rationale=rationale,
        )))

    # ── 1. Reduce cycle time by 10% ──────────────────────────────────────
    new_ct = round(base_input.cycle_time * 0.90, 2)
    base_pph = (3600.0 / (base_input.cycle_time / (base_input.oee / 100.0))) * base_input.cavities
    new_pph = (3600.0 / (new_ct / (base_input.oee / 100.0))) * base_input.cavities
    _add(
        category="CYCLE_TIME",
        title=f"Reduce Cycle Time {base_input.cycle_time:.1f}s → {new_ct:.1f}s (−10%)",
        action=(
            f"Optimize gate design, cooling channel layout, and hot runner balance. "
            f"Consider conformal cooling insert or mold flow re-simulation. "
            f"Target: {new_ct:.1f}s cycle time."
        ),
        rationale=(
            f"Shorter cycle increases throughput from {base_pph:.0f} to {new_pph:.0f} parts/hr, "
            f"reducing machine, labor, and energy cost per part proportionally."
        ),
        modified=base_input.model_copy(update={"cycle_time": new_ct}),
    )

    # ── 2. Improve OEE by 5 pp ───────────────────────────────────────────
    new_oee = min(base_input.oee + 5.0, 95.0)
    eff_before = base_input.cycle_time / (base_input.oee / 100.0)
    eff_after = base_input.cycle_time / (new_oee / 100.0)
    _add(
        category="OEE",
        title=f"Improve OEE {base_input.oee:.1f}% → {new_oee:.1f}% (+5pp)",
        action=(
            f"Implement Total Productive Maintenance (TPM): reduce unplanned downtime, "
            f"shorten changeover (SMED), and improve quality rate. "
            f"Target OEE: {new_oee:.1f}%."
        ),
        rationale=(
            f"Effective cycle time drops from {eff_before:.2f}s to {eff_after:.2f}s, "
            f"delivering more parts per hour from the same machine investment."
        ),
        modified=base_input.model_copy(update={"oee": new_oee}),
    )

    # ── 3. Reduce scrap rate by 2 pp ─────────────────────────────────────
    new_scrap = max(base_input.scrap_rate - 2.0, 0.0)
    _add(
        category="SCRAP",
        title=f"Reduce Scrap {base_input.scrap_rate:.1f}% → {new_scrap:.1f}% (−2pp)",
        action=(
            f"Deploy Statistical Process Control (SPC) on critical dimensions, "
            f"perform mold flow analysis, and implement automated vision inspection. "
            f"Target scrap: {new_scrap:.1f}%."
        ),
        rationale=(
            f"Each rejected part consumes full material cost. Scrap reduction "
            f"directly improves material yield, the typically largest cost driver."
        ),
        modified=base_input.model_copy(update={"scrap_rate": new_scrap}),
    )

    # ── 4. Negotiate material price down 10% ─────────────────────────────
    new_mat = round(base_input.material_price_per_kg * 0.90, 4)
    _add(
        category="MATERIAL",
        title=f"Negotiate Material Price ${base_input.material_price_per_kg:.2f}/kg → ${new_mat:.2f}/kg (−10%)",
        action=(
            f"Issue competitive RFQ to 3 approved material suppliers. "
            f"Evaluate alternative qualified grades or resin blends. "
            f"Target price: ${new_mat:.2f}/kg."
        ),
        rationale=(
            f"Material cost is typically 40–60% of total part cost. "
            f"10% reduction in material price yields proportional savings."
        ),
        modified=base_input.model_copy(update={"material_price_per_kg": new_mat}),
    )

    # ── 5. Add one cavity (if ≤ 4 cavities) ──────────────────────────────
    if base_input.cavities <= 4:
        new_cav = base_input.cavities + 1
        # Adding a cavity increases tool cost by ~35% but improves throughput
        new_tool = round(base_input.tool_cost * 1.35, 2)
        _add(
            category="TOOLING",
            title=f"Upgrade Mold: {base_input.cavities} → {new_cav} cavities",
            action=(
                f"Request toolmaker quotation for {new_cav}-cavity mold. "
                f"Estimated tool cost increase ~35% (${new_tool - base_input.tool_cost:,.0f}). "
                f"Evaluate net payback at {base_input.annual_volume:,} parts/yr."
            ),
            rationale=(
                f"Additional cavity increases parts per shot by "
                f"{100 / base_input.cavities:.0f}%, reducing machine, labor, "
                f"and energy cost per part. Net benefit depends on amortized tooling delta."
            ),
            modified=base_input.model_copy(update={"cavities": new_cav, "tool_cost": new_tool}),
        )

    # ── 6. Reduce machine rate via renegotiation or asset swap ───────────
    new_machine_rate = round(base_input.machine_hourly_rate * 0.90, 2)
    _add(
        category="MACHINE",
        title=f"Reduce Machine Rate ${base_input.machine_hourly_rate:.0f}/hr → ${new_machine_rate:.0f}/hr (−10%)",
        action=(
            f"Evaluate machine-sharing arrangements, off-peak shift scheduling, "
            f"or alternative press capacity at ${new_machine_rate:.0f}/hr."
        ),
        rationale=(
            f"Machine rate reduction directly lowers the largest hourly cost component."
        ),
        modified=base_input.model_copy(update={"machine_hourly_rate": new_machine_rate}),
    )

    # ── Sort by savings, assign priority, return top 5 ───────────────────
    candidates.sort(key=lambda x: x[0], reverse=True)

    result: List[Recommendation] = []
    for i, (_, rec) in enumerate(candidates[:5]):
        rec.priority = i + 1
        result.append(rec)

    return result
