"""
Risk assessment engine for RFQ projects.

Evaluates three risk dimensions:
    OEE    — production efficiency and machine reliability
    Scrap  — material waste and quality process stability
    Volume — tool amortization exposure and demand risk

Scoring:
    4 points = critical
    3 points = high concern
    2 points = moderate
    1 point  = minor flag

Overall risk:
    ≥ 6 points → HIGH
    ≥ 3 points → MEDIUM
    < 3 points → LOW
"""

from app.schemas.rfq import RFQInput, RiskFactor, RiskResult


def calculate_risk(inp: RFQInput) -> RiskResult:
    factors: list[RiskFactor] = []
    score = 0

    # ── OEE Risk ─────────────────────────────────────────────────────────
    if inp.oee < 65:
        score += 4
        factors.append(RiskFactor(
            category="OEE", severity="HIGH",
            message=(
                f"OEE {inp.oee:.1f}% is critically low. "
                "Machine losses severely inflate per-part cost and delivery risk."
            ),
        ))
    elif inp.oee < 75:
        score += 3
        factors.append(RiskFactor(
            category="OEE", severity="HIGH",
            message=(
                f"OEE {inp.oee:.1f}% is below acceptable threshold. "
                "High unplanned downtime risk. Investigate availability losses."
            ),
        ))
    elif inp.oee < 82:
        score += 2
        factors.append(RiskFactor(
            category="OEE", severity="MEDIUM",
            message=(
                f"OEE {inp.oee:.1f}% indicates moderate production losses. "
                "Performance or quality losses should be addressed before SOP."
            ),
        ))
    elif inp.oee < 87:
        score += 1
        factors.append(RiskFactor(
            category="OEE", severity="LOW",
            message=(
                f"OEE {inp.oee:.1f}% is slightly below world-class (≥87%). "
                "Monitor trend; improvement recommended."
            ),
        ))

    # ── Scrap Rate Risk ───────────────────────────────────────────────────
    if inp.scrap_rate > 10:
        score += 4
        factors.append(RiskFactor(
            category="SCRAP", severity="HIGH",
            message=(
                f"Scrap {inp.scrap_rate:.1f}% is critically high. "
                "Process is unstable. Do not quote without process improvements."
            ),
        ))
    elif inp.scrap_rate > 6:
        score += 3
        factors.append(RiskFactor(
            category="SCRAP", severity="HIGH",
            message=(
                f"Scrap {inp.scrap_rate:.1f}% exceeds acceptable limits (≤6%). "
                "Mold flow analysis and SPC required before committing to price."
            ),
        ))
    elif inp.scrap_rate > 4:
        score += 2
        factors.append(RiskFactor(
            category="SCRAP", severity="MEDIUM",
            message=(
                f"Scrap {inp.scrap_rate:.1f}% is above target (≤4%). "
                "Quality monitoring plan required at launch."
            ),
        ))
    elif inp.scrap_rate > 2:
        score += 1
        factors.append(RiskFactor(
            category="SCRAP", severity="LOW",
            message=(
                f"Scrap {inp.scrap_rate:.1f}% is manageable but monitor trend. "
                "SPC charts recommended."
            ),
        ))

    # ── Volume Risk ───────────────────────────────────────────────────────
    if inp.annual_volume < 25_000:
        score += 4
        factors.append(RiskFactor(
            category="VOLUME", severity="HIGH",
            message=(
                f"Volume {inp.annual_volume:,} parts/year is very low. "
                "Tool amortization dominates cost. Demand risk is extreme."
            ),
        ))
    elif inp.annual_volume < 75_000:
        score += 3
        factors.append(RiskFactor(
            category="VOLUME", severity="HIGH",
            message=(
                f"Volume {inp.annual_volume:,} parts/year is low. "
                "High sensitivity to volume shortfall. Secure volume commitment."
            ),
        ))
    elif inp.annual_volume < 150_000:
        score += 2
        factors.append(RiskFactor(
            category="VOLUME", severity="MEDIUM",
            message=(
                f"Volume {inp.annual_volume:,} parts/year is moderate. "
                "Verify OEM program commitment and platform stability."
            ),
        ))
    elif inp.annual_volume < 300_000:
        score += 1
        factors.append(RiskFactor(
            category="VOLUME", severity="LOW",
            message=(
                f"Volume {inp.annual_volume:,} parts/year is acceptable. "
                "Monitor order stability across program life."
            ),
        ))

    # ── Overall Level ─────────────────────────────────────────────────────
    if score >= 6:
        level = "HIGH"
    elif score >= 3:
        level = "MEDIUM"
    else:
        level = "LOW"

    return RiskResult(level=level, score=score, factors=factors)
