import type { RfqInput, YearPnL, YearWC, YearCF, NpvResult } from '../types/rfq';
import { safe, safeDiv } from '../utils/formatters';

export function calcNPV(cashflows: number[], rate: number): number {
  return cashflows.reduce((sum, cf, i) => sum + cf / Math.pow(1 + rate, i + 1), 0);
}

/** Newton-Raphson IRR. Returns null if no convergence within maxIter. */
export function calcIRR(cashflows: number[], maxIter = 150): number | null {
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
    if (r < -0.999 || r > 100) return null;
  }
  return null;
}

/** Linear interpolation payback in months from annual FCF array. */
function calcPaybackMonths(cf: YearCF[], discounted = false, wacc = 0): number | null {
  let cumulative = 0;
  for (let i = 0; i < cf.length; i++) {
    const value = discounted
      ? cf[i].freeCF / Math.pow(1 + wacc, i + 1)
      : cf[i].freeCF;
    const prevCumulative = cumulative;
    cumulative += value;
    if (cumulative >= 0) {
      const fraction = prevCumulative < 0 ? -prevCumulative / (cumulative - prevCumulative) : 0;
      return Math.round((i + fraction) * 12 * 10) / 10;
    }
  }
  return null;
}

/**
 * Full NPV/IRR/ROCE calculation.
 * @param hurdleIrr  Minimum acceptable IRR (from FinancialThresholds, not RfqInput)
 */
export function calcNpv(cf: YearCF[], pnl: YearPnL[], wc: YearWC[], inp: RfqInput, hurdleIrr: number): NpvResult {
  const freeCFs = cf.map(y => y.freeCF);
  const npv = calcNPV(freeCFs, inp.wacc);
  const irrValue = calcIRR(freeCFs);

  const paybackMonths = calcPaybackMonths(cf, false);
  const discountedPayback = calcPaybackMonths(cf, true, inp.wacc);

  // ROCE Y3 (or last year if lifecycle < 3)
  const y3Idx = Math.min(2, cf.length - 1);
  const EBIT_Y3 = pnl[y3Idx]?.ebit ?? 0;

  // Tooling NBV at year (y3Idx+1) — only for supplier-owned tools
  const annualDepr = inp.toolOwnershipType === 'supplier'
    ? safeDiv(inp.toolCost, inp.toolDepreciationYears)
    : 0;
  const toolingNBV_Y3 = safe(Math.max(0, inp.toolCost - annualDepr * (y3Idx + 1)));

  // Average net WC between year y3Idx and prior year
  const wcY3   = wc[y3Idx]?.netWC ?? 0;
  const wcPrev = y3Idx >= 1 ? (wc[y3Idx - 1]?.netWC ?? 0) : 0;
  const avgWC_Y3 = y3Idx >= 1 ? (wcPrev + wcY3) / 2 : wcY3;

  const capitalEmployed = Math.max(toolingNBV_Y3 + avgWC_Y3 + inp.ebitdaAssetBase, 1);
  const roceY3 = safeDiv(EBIT_Y3, capitalEmployed);

  const meetsHurdle = (irrValue !== null && irrValue >= hurdleIrr) && npv > 0;

  return { npv, irr: irrValue, paybackMonths, discountedPayback, roceY3, y3Idx, meetsHurdle };
}
