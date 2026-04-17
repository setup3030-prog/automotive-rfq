import type { RfqInput, YearPnL, YearWC, YearCF } from '../types/rfq';
import { safe } from '../utils/formatters';

const TAX_RATE = 0.19; // Polish CIT

/**
 * Build free cash flow schedule.
 * CAPEX for tooling lands in Year 1 (index 0):
 *   supplier         → full toolCost
 *   customer_amortized → 50% up-front (rest recovered via piece price)
 *   customer_paid    → 0
 */
export function calcCashflow(pnl: YearPnL[], wc: YearWC[], inp: RfqInput): YearCF[] {
  const capexY1 = inp.toolOwnershipType === 'supplier'
    ? inp.toolCost
    : inp.toolOwnershipType === 'customer_amortized'
    ? inp.toolCost * 0.5
    : 0;

  let cumulativeFCF = 0;

  return pnl.map((y, idx) => {
    const taxPaid = safe(Math.max(0, y.ebit) * TAX_RATE);
    const deltaWC  = wc[idx]?.deltaWC ?? 0;
    const capex    = idx === 0 ? capexY1 : 0;

    const operatingCF = safe(y.ebitda - taxPaid - deltaWC);
    const freeCF      = safe(operatingCF - capex);
    cumulativeFCF = safe(cumulativeFCF + freeCF);

    return { year: y.year, ebitda: y.ebitda, taxPaid, deltaWC, capex, operatingCF, freeCF, cumulativeFCF };
  });
}
