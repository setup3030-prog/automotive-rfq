# Pricing Tier Semantics

## Convention (enforced across frontend + backend)

| Tier | Margin | Price | Role |
|------|--------|-------|------|
| **walkAway** | 5% (`marginMin`) | lowest | Absolute floor. Never accept below this. |
| **aggressive** | 9% (`marginAggressive`) | mid | Competitive bid to win price-sensitive accounts. |
| **target** | 15% (`marginTarget`) | highest | Opening negotiation anchor. Room to concede toward aggressive. |

Ordering invariant: `walkAway.price < aggressive.price < target.price`
Margin ordering: `marginMin < marginAggressive < marginTarget`

## Defaults

Frontend (`RfqContext.tsx` `DEFAULT_MARGINS`):
```
marginMin: 0.05, marginAggressive: 0.09, marginTarget: 0.15
```

Backend (`pricing.py`):
```python
WALK_AWAY_MARGIN = 0.05
AGGRESSIVE_MARGIN = 0.09
TARGET_MARGIN = 0.15
```

## Risk Labels (priceStrategy.ts)

Risk is derived from margin value only — not from tier name:

| Margin | Label |
|--------|-------|
| < 8%   | 🔴 HIGH RISK |
| 8–12%  | 🟡 MEDIUM RISK |
| 12–20% | 🟢 LOW RISK |
| > 20%  | 🟢 STRONG MARGIN |

## Usage by component

- **Dashboard**: BEV uses `ps.walkAway.breakEvenVolume` (walk-away is the binding constraint).
- **Competitiveness**: `aggressivePrice <= compLow` → VERY COMPETITIVE; `targetPrice <= compHigh` → MARGINAL.
- **Scenarios**: selling price derived from `marginTarget` (realistic anchor).
- **BEV formula**: `fixedOverhead / (walkAwayPrice - variableCostPerPart)`.