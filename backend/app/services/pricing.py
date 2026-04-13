"""
Three-tier RFQ pricing strategy engine.

Prices are derived cost-up using target margin percentages.
Formula: price = cost / (1 − margin%)

Tiers:
    walk_away  → 5%  — absolute minimum; decline below this
    aggressive → 9%  — competitive bid to win volume
    target     → 15% — opening negotiation anchor
"""

from app.schemas.rfq import PriceLevel, PricingResult

WALK_AWAY_MARGIN = 0.05    # 5%
AGGRESSIVE_MARGIN = 0.09   # 9%
TARGET_MARGIN = 0.15       # 15%


def calculate_pricing(total_cost: float) -> PricingResult:
    """
    Generate three-tier pricing strategy from total cost per part.

    Args:
        total_cost: Total manufactured cost per part ($)

    Returns:
        PricingResult with walk-away, aggressive, and target prices.
    """
    walk_away_price = total_cost / (1.0 - WALK_AWAY_MARGIN)
    aggressive_price = total_cost / (1.0 - AGGRESSIVE_MARGIN)
    target_price = total_cost / (1.0 - TARGET_MARGIN)

    return PricingResult(
        walk_away=PriceLevel(
            label="Walk-Away",
            price=round(walk_away_price, 6),
            margin_pct=WALK_AWAY_MARGIN * 100,
            description=(
                "Absolute minimum price. Covers cost with 5% margin buffer. "
                "Do NOT accept any price below this level."
            ),
        ),
        aggressive=PriceLevel(
            label="Aggressive RFQ",
            price=round(aggressive_price, 6),
            margin_pct=AGGRESSIVE_MARGIN * 100,
            description=(
                "Competitive bid price for volume wins. "
                "Use when customer is price-sensitive and strategic."
            ),
        ),
        target=PriceLevel(
            label="Target Price",
            price=round(target_price, 6),
            margin_pct=TARGET_MARGIN * 100,
            description=(
                "Optimal sustainable price. Open negotiations here. "
                "Gives room to concede toward aggressive without losing margin."
            ),
        ),
    )
