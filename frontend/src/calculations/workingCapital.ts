import type { RfqInput, YearPnL, YearWC } from '../types/rfq';
import { safe, safeDiv } from '../utils/formatters';

/**
 * Calculate year-by-year working capital requirements.
 * DSO = paymentTerms, DPO = dpoDays, DIO = dioDays.
 */
export function calcWorkingCapital(pnl: YearPnL[], inp: RfqInput): YearWC[] {
  const dso = inp.paymentTerms;   // days sales outstanding (same as payment terms)
  const dpo = inp.dpoDays;
  const dio = inp.dioDays;

  return pnl.map((y, idx) => {
    const cogsVariable = safe(y.cogsMaterial + y.cogsLabor + y.cogsEnergy + y.cogsOverheadDirect);

    const receivables = safe(y.revenue * dso / 360);
    const inventory   = safe(cogsVariable * dio / 360);
    const payables    = safe(y.cogsMaterial * dpo / 360);
    const netWC       = safe(receivables + inventory - payables);

    const prevNetWC = idx === 0 ? 0 : (safe(
      pnl[idx - 1].revenue * dso / 360
      + (safe(pnl[idx - 1].cogsMaterial + pnl[idx - 1].cogsLabor + pnl[idx - 1].cogsEnergy + pnl[idx - 1].cogsOverheadDirect)) * dio / 360
      - pnl[idx - 1].cogsMaterial * dpo / 360
    ));
    const deltaWC = safe(netWC - prevNetWC);

    return { year: y.year, receivables, inventory, payables, netWC, deltaWC };
  });
}

export function peakNetWC(wc: YearWC[]): number {
  return wc.reduce((max, y) => Math.max(max, y.netWC), 0);
}
