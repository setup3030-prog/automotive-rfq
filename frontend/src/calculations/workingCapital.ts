import type { RfqInput, YearPnL, YearWC } from '../types/rfq';
import { safe } from '../utils/formatters';

/**
 * Calculate year-by-year working capital requirements.
 * DSO = paymentTerms, DPO = dpoDays, DIO = dioDays.
 */
export function calcWorkingCapital(pnl: YearPnL[], inp: RfqInput): YearWC[] {
  const dso = inp.paymentTerms;
  const dpo = inp.dpoDays;
  const dio = inp.dioDays;

  let prevNetWC = 0;

  return pnl.map(y => {
    const cogsVariable = safe(y.cogsMaterial + y.cogsLabor + y.cogsEnergy + y.cogsOverheadDirect);
    const receivables = safe(y.revenue * dso / 360);
    const inventory   = safe(cogsVariable * dio / 360);
    const payables    = safe(y.cogsMaterial * dpo / 360);
    const netWC       = safe(receivables + inventory - payables);
    const deltaWC     = safe(netWC - prevNetWC);
    prevNetWC = netWC;

    return { year: y.year, receivables, inventory, payables, netWC, deltaWC };
  });
}

export function peakNetWC(wc: YearWC[]): number {
  return wc.reduce((max, y) => Math.max(max, y.netWC), 0);
}
