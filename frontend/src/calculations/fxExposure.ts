import type { RfqInput, YearPnL, FxExposureResult } from '../types/rfq';
import { safe, safeDiv } from '../utils/formatters';

export function calcFxExposure(pnl: YearPnL[], inp: RfqInput): FxExposureResult {
  if (pnl.length === 0) {
    return { revenueEur: 0, costEur: 0, netOpenEur: 0, hedgedEur: 0, unhedgedEur: 0, marginImpactFxPlus10Pp: 0, marginImpactFxMinus10Pp: 0, naturalHedgePct: 0 };
  }

  const avgRevenuePln = pnl.reduce((s, y) => s + y.revenue, 0) / pnl.length;
  const avgTotalCogsPln = pnl.reduce((s, y) => s + y.cogsMaterial + y.cogsLabor + y.cogsMachine + y.cogsEnergy + y.cogsOverheadDirect + y.cogsToolingAmort, 0) / pnl.length;

  const revenueEur = safe(avgRevenuePln * inp.fxEurShareRevenue / inp.fxEurPln);
  const costEur    = safe(avgTotalCogsPln * inp.fxEurShareCost / inp.fxEurPln);

  // Net open position: unhedged portion of (revenue_eur - cost_eur)
  const grossOpenEur = safe(revenueEur - costEur);
  const hedgedEur    = safe(grossOpenEur * inp.fxHedgeRatio);
  const unhedgedEur  = safe(grossOpenEur * (1 - inp.fxHedgeRatio));
  const netOpenEur   = unhedgedEur;

  // Impact of ±10% EUR/PLN on annual EBITDA as % of revenue
  const avgRevenue = avgRevenuePln > 0 ? avgRevenuePln : 1;
  const marginImpactFxPlus10Pp  = safeDiv(unhedgedEur * inp.fxEurPln * 0.1, avgRevenue) * 100;
  const marginImpactFxMinus10Pp = -marginImpactFxPlus10Pp;

  // Natural hedge: how much of revenue EUR is naturally offset by cost EUR
  const naturalHedgePct = safe(Math.min(inp.fxEurShareCost, inp.fxEurShareRevenue) * 100);

  return { revenueEur, costEur, netOpenEur, hedgedEur, unhedgedEur, marginImpactFxPlus10Pp, marginImpactFxMinus10Pp, naturalHedgePct };
}
