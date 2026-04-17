import type { RfqInput, YearCF, NpvResult } from '../types/rfq';
import { safe, safeDiv } from '../utils/formatters';

export function calcNPV(cashflows: number[], rate: number): number {
  return cashflows.reduce((sum, cf, i) => sum + cf / Math.pow(1 + rate, i + 1), 0);
}

/** Newton-Raphson IRR. Returns null if no convergence within maxIter. */
export function calcIRR(cashflows: number[], maxIter = 150): number | null {
  // Initial investment must be negative for IRR to make sense
  if (cashflows.length === 0 || cashflows[0] >= 0) return null;

  let r = 0.1;
  for (let i = 0; i < maxIter; i++) {
    let npv = 0;
    let dnpv = 0;
    for (let j = 0; j < cashflows.length; j++) {
      const pv = cashflows[j] / Math.pow(1 + r, j + 1);
      npv += pv;
      dnpv -= (j + 1) * pv / (1 + r);
    }
    if (Math.abs(dnpv) < 1e-12) return null;
    const rNew = r - npv / dnpv;
    if (Math.abs(rNew - r) < 1e-8) return rNew;
    r = rNew;
    if (r < -0.999 || r > 100) return null; // diverged
  }
  return null;
}

/** Linear interpolation payback in months from annual FCF array (already includes Y1 capex). */
function calcPaybackMonths(cf: YearCF[], discounted = false, wacc = 0): number | null {
  let cumulative = 0;
  for (let i = 0; i < cf.length; i++) {
    const value = discounted
      ? cf[i].freeCF / Math.pow(1 + wacc, i + 1)
      : cf[i].freeCF;
    const prevCumulative = cumulative;
    cumulative += value;
    if (cumulative >= 0) {
      // interpolate
      const fraction = prevCumulative < 0 ? -prevCumulative / (cumulative - prevCumulative) : 0;
      return Math.round((i + fraction) * 12 * 10) / 10;
    }
  }
  return null; // never reaches breakeven within lifecycle
}

export function calcNpv(cf: YearCF[], inp: RfqInput): NpvResult {
  const freeCFs = cf.map(y => y.freeCF);
  // Add an implicit Year-0 cash outflow of 0 for NPV indexing (capex already in freeCF[0])
  const npv = calcNPV(freeCFs, inp.wacc);

  // IRR: treat Y1 FCF (with capex) as the initial outflow; remaining years as inflows
  // We need a sign-change pattern for IRR. Check if first CF is negative.
  const irrValue = calcIRR(freeCFs);

  const paybackMonths = calcPaybackMonths(cf, false);
  const discountedPayback = calcPaybackMonths(cf, true, inp.wacc);

  // ROCE Y3: EBIT_Y3 / (toolingNBV_Y3 + avgWC_Y3 + ebitdaAssetBase)
  const y3 = cf.length >= 3 ? cf[2] : cf[cf.length - 1];
  const pnlY3Ebit = y3.ebitda - (y3.taxPaid / (1 - 0.19) * 0.19); // approximate: taxPaid = max(0, EBIT*0.19)
  // Actually we don't have EBIT directly in YearCF; we have ebitda. EBIT = EBITDA - depreciation.
  // Depreciation is in YearPnL. We can approximate: EBIT ≈ EBITDA - depreciation.
  // Since we don't have it here directly, use EBITDA as proxy for ROCE numerator.
  const toolingNBV_Y3 = inp.toolOwnershipType === 'supplier'
    ? safe(inp.toolCost * Math.max(0, 1 - 3 / inp.toolDepreciationYears))
    : 0;
  const avgWC_Y3 = 0; // will be filled by caller if needed; use 0 as fallback
  const roceY3 = safeDiv(y3.ebitda, toolingNBV_Y3 + avgWC_Y3 + inp.ebitdaAssetBase + 1e-9);

  const meetsHurdle = (irrValue !== null && irrValue >= inp.hurdleRate) && npv > 0;

  return { npv, irr: irrValue, paybackMonths, discountedPayback, roceY3, meetsHurdle };
}
