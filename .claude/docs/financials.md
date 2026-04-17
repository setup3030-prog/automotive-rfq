# Financial Analysis Module

Documents all financial fields, formulas, conventions, and thresholds for the Financials tab (Tab 9).

## Input Fields (`RfqInput`)

| Field | Type | Default | Notes |
|---|---|---|---|
| `lifecycleYears` | number | 5 | Program duration in years |
| `volumeCurve` | number[] | [1,1,1,1,1] | Relative volume multipliers per year; auto-extended if shorter than `lifecycleYears` |
| `sopDateIso` | string | today+6mo | SOP date (ISO, e.g. `"2026-10-01"`). Separate from `sopDate` checklist boolean |
| `dpoDays` | number | 45 | Days Payable Outstanding |
| `dioDays` | number | 45 | Days Inventory Outstanding |
| `wacc` | number | 0.10 | Discount rate (fraction, e.g. 0.10 = 10%) |
| `hurdleRate` | number | 0.12 | Minimum acceptable IRR (fraction) |
| `toolOwnershipType` | `'customer_paid' \| 'customer_amortized' \| 'supplier'` | `'customer_amortized'` | Determines CAPEX treatment |
| `toolDepreciationYears` | number | 5 | Only relevant when `toolOwnershipType === 'supplier'` |
| `bankGuaranteePct` | number | 0.01 | Annual bank guarantee cost as fraction of tool cost |
| `warrantyReservePct` | number | 0.005 | Annual warranty reserve as fraction of revenue |
| `ldCapPct` | number | 0.05 | LD cap as fraction of total lifecycle revenue |
| `fxEurShareCost` | number | 0.30 | Fraction of costs denominated in EUR |
| `fxEurShareRevenue` | number | 0.20 | Fraction of revenue denominated in EUR |
| `fxHedgeRatio` | number | 0.50 | Fraction of gross FX open position that is hedged |
| `fxEurPln` | number | 4.28 | Reference EUR/PLN exchange rate |
| `escalationMaterial` | number | 0 | Annual material price escalation (fraction, e.g. 0.03 = 3%); 0 = pass-through |
| `escalationMaterialLagQuarters` | number | 2 | Quarters until escalation takes effect |
| `escalationEnergy` | number | 0 | Annual energy escalation (fraction); 0 = pass-through |
| `escalationLaborCpi` | number | 0.025 | Annual labor CPI escalation (fraction) |
| `customerRating` | string | `'BBB'` | Credit rating for default probability lookup |
| `customerInsuredPct` | number | 0.80 | Fraction of credit exposure covered by insurance |
| `corporateOverheadAllocationPct` | number | 0.03 | Annual corporate overhead as fraction of revenue |
| `ebitdaAssetBase` | number | 50000 | EBITDA asset base used in ROCE Y3 denominator |

## Computed Pipeline

All financial results are computed reactively in `RfqContext.tsx` via `useMemo`:

```
costModel → priceStrategy → programPnL → workingCapital → cashflow → npv → financialRisk → fxExposure
```

## Formulas

### P&L (`programPnL.ts`)

```
revenue_y       = targetPrice × volumeY
cogsMaterial_y  = materialCostPerPart × volumeY × (1 + escalationMaterial)^y   [Y1: +2% ramp]
cogsLabor_y     = laborCostPerPart × volumeY × (1 + escalationLaborCpi)^y
cogsMachine_y   = machineCostPerPart × volumeY
cogsEnergy_y    = energyCostPerPart × volumeY × (1 + escalationEnergy)^y
cogsToolingAmort_y = toolCost / lifecycleYears   [only if toolOwnershipType === 'supplier']
grossProfit_y   = revenue_y − Σcogs_y
corporateOverheadAlloc_y = revenue_y × corporateOverheadAllocationPct
annualDepreciation_y = toolCost / toolDepreciationYears   [only if toolOwnershipType === 'supplier']
ebitda_y        = grossProfit_y − corporateOverheadAlloc_y
ebit_y          = ebitda_y − annualDepreciation_y
```

### Working Capital (`workingCapital.ts`)

```
receivables_y = revenue_y × DSO / 360          (DSO = paymentTerms)
inventory_y   = cogsVariable_y × DIO / 360
payables_y    = cogsMaterial_y × DPO / 360
netWC_y       = receivables_y + inventory_y − payables_y
deltaWC_y     = netWC_y − netWC_{y-1}          (Y1: deltaWC = netWC_1)
peakNetWC     = max(netWC_y) across all years
```

### Cash Flow (`cashflow.ts`)

```
TAX_RATE = 0.19
taxPaid_y     = max(0, ebit_y × TAX_RATE)
capex_y       = Y1 only:
                  supplier          → toolCost
                  customer_amortized → toolCost × 0.50
                  customer_paid     → 0
operatingCF_y = ebitda_y − taxPaid_y − deltaWC_y
freeCF_y      = operatingCF_y − capex_y
cumulativeFCF_y = Σ freeCF[0..y]
```

### NPV / IRR / ROCE (`npv.ts`)

```
NPV = Σ freeCF[i] / (1 + wacc)^(i+1)          i = 0..N-1

IRR = r such that NPV(r) = 0
      Newton-Raphson, seed = 0.10, max 150 iterations
      Returns null if not converged

paybackMonths = first month where cumulativeFCF ≥ 0 (interpolated)
discountedPaybackMonths = same using discounted flows

ROCE Y3 = EBIT_Y3 / (toolingNBV_Y3 + avgWC_Y3 + ebitdaAssetBase)
  toolingNBV_Y3 = toolCost − annualDepreciation × 3   (clipped at 0)
  avgWC_Y3      = (netWC_Y2 + netWC_Y3) / 2

meetsHurdle = (irr !== null && irr >= hurdleRate) && (npv > 0)
```

### FX Exposure (`fxExposure.ts`)

```
revenueEur   = avgAnnualRevenue × fxEurShareRevenue / fxEurPln
costEur      = avgAnnualCost × fxEurShareCost / fxEurPln
grossOpenEur = |revenueEur − costEur|
netOpenEur   = grossOpenEur × (1 − fxHedgeRatio)
unhedgedEur  = netOpenEur   (alias)
naturalHedgePct = min(fxEurShareCost, fxEurShareRevenue) × 100

marginImpactFxPlus10Pp  = +10% EUR move → impact on operating margin (pp)
marginImpactFxMinus10Pp = −10% EUR move → impact on operating margin (pp)
```

### Financial Risk Scenarios (`financialRisk.ts`)

7 scenarios computed by re-running NPV with modified inputs:

| Scenario | Shock |
|---|---|
| Volume −20% | all volumes × 0.80 |
| Volume −40% | all volumes × 0.60 |
| Material +15% | materialPricePerKg × 1.15 (only if escalationMaterial === 0) |
| Energy +30% | energyPrice × 1.30 (only if escalationEnergy === 0) |
| EUR/PLN −10% | fxEurPln × 0.90 |
| EUR/PLN +10% | fxEurPln × 1.10 |
| SOP delay 3 months | volumeCurve[0] × 0.75 |

Sorted by |ΔNPV| descending.

## Volume Curve Convention

`volumeCurve` is an array of **relative multipliers** (not absolute volumes).
- Default `[1,1,1,1,1]` means flat volume = `annualVolume` each year.
- `[0.5, 1, 1.2, 1.2, 0.8]` means ramp-up Y1, peak Y3–4, wind-down Y5.
- If the array is shorter than `lifecycleYears`, it is **padded** with its last value.

## Tool Ownership Type

| Value | CAPEX Y1 | Depreciation | Best for |
|---|---|---|---|
| `customer_paid` | 0 | none | Customer funds tool upfront |
| `customer_amortized` | toolCost × 0.5 | none | Piece-price amortization |
| `supplier` | toolCost | toolCost / toolDepreciationYears | Supplier owns tool |

## Default Thresholds (`financialThresholds.ts`)

Stored in localStorage `rfq-financial-thresholds-v1`. Editable via ⚙ Thresholds modal.

| Threshold | Default | Flag logic |
|---|---|---|
| `hurdleIrr` | 12% | green ≥ hurdle; yellow ≥ 8%; red < 8% |
| `hurdleRoce` | 18% | green ≥ hurdle; yellow ≥ 10%; red < 10% |
| `hurdlePaybackMonths` | 36 mo | green ≤ hurdle; yellow ≤ 48; red > 48 |
| `wcIntensityWarn` | 20% of revenue | yellow |
| `wcIntensityCrit` | 25% of revenue | red |
| `gmWarnPct` | 15% | yellow |
| `gmCritPct` | 10% | red |