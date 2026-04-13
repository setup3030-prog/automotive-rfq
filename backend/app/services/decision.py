"""
GO / NO GO decision engine.

Rules (evaluated in priority order):
    1. NO GO — margin at aggressive price < 5% (walk-away threshold)
    2. NO GO — risk is HIGH AND margin at aggressive price < 10%
    3. GO    — with alerts for marginal situations

The engine references the *aggressive* price (9% margin target) as the
decision benchmark because that is the actual bid price submitted to the OEM.
"""

from app.schemas.rfq import PricingResult, RiskResult, DecisionResult

MIN_MARGIN_FLOOR = 5.0       # Absolute minimum — below this, decline
HIGH_RISK_MIN_MARGIN = 10.0  # HIGH risk projects need a larger buffer


def calculate_decision(
    total_cost: float,
    pricing: PricingResult,
    risk: RiskResult,
) -> DecisionResult:
    """
    Determine GO / NO GO and generate structured reasons and alerts.

    Args:
        total_cost: Total manufactured cost per part ($)
        pricing:    Three-tier pricing result
        risk:       Risk assessment result

    Returns:
        DecisionResult with decision, margins, reasons, and alerts.
    """
    agg_price = pricing.aggressive.price
    tgt_price = pricing.target.price

    margin_agg = ((agg_price - total_cost) / agg_price) * 100.0
    margin_tgt = ((tgt_price - total_cost) / tgt_price) * 100.0

    decision = "GO"
    reasons: list[str] = []
    alerts: list[str] = []

    # ── Rule 1: Walk-away floor ──────────────────────────────────────────
    if margin_agg < MIN_MARGIN_FLOOR:
        decision = "NO GO"
        reasons.append(
            f"Margin at aggressive bid price ({margin_agg:.1f}%) is below the "
            f"walk-away threshold of {MIN_MARGIN_FLOOR:.0f}%. "
            "This project will lose money at any competitive price."
        )

    # ── Rule 2: High risk + thin margin ─────────────────────────────────
    if risk.level == "HIGH" and margin_agg < HIGH_RISK_MIN_MARGIN:
        decision = "NO GO"
        reasons.append(
            f"HIGH operational risk with only {margin_agg:.1f}% margin at "
            f"aggressive price. Risk-adjusted return is insufficient. "
            f"Minimum {HIGH_RISK_MIN_MARGIN:.0f}% margin required for HIGH-risk projects."
        )

    # ── GO path: alerts and affirmations ────────────────────────────────
    if decision == "GO":
        # Positive reasons
        if margin_agg >= 15.0:
            reasons.append(
                f"Strong margin {margin_agg:.1f}% at aggressive bid with {risk.level} risk. "
                "Recommend starting negotiations at target price."
            )
        elif margin_agg >= 10.0:
            reasons.append(
                f"Acceptable margin {margin_agg:.1f}% with {risk.level} risk profile. "
                "Project meets financial criteria."
            )
        else:
            reasons.append(
                f"Marginal GO: {margin_agg:.1f}% margin at aggressive price. "
                "Pursue process improvements before SOP."
            )

        # Alerts
        if risk.level == "HIGH":
            alerts.append(
                "HIGH risk project — requires executive approval, risk mitigation plan, "
                "and contractual volume guarantees."
            )
        if risk.level == "MEDIUM" and margin_agg < 10.0:
            alerts.append(
                "MEDIUM risk with thin margin — establish production KPIs and "
                "quarterly margin reviews."
            )
        if margin_agg < 8.0:
            alerts.append(
                f"Margin ({margin_agg:.1f}%) is very tight at aggressive price. "
                f"Push toward target price (${tgt_price:.4f}) in negotiations."
            )
        if margin_agg < margin_tgt - 3.0:
            alerts.append(
                f"Gap between aggressive (${agg_price:.4f}) and target (${tgt_price:.4f}) "
                "gives negotiation room — do not open at aggressive unless necessary."
            )

    return DecisionResult(
        decision=decision,
        margin_at_aggressive_pct=round(margin_agg, 2),
        margin_at_target_pct=round(margin_tgt, 2),
        reasons=reasons,
        alerts=alerts,
    )
