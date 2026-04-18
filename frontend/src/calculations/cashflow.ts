import type { RfqInput, YearPnL, YearWC, YearCF } from '../types/rfq';
import { safe } from '../utils/formatters';

const TAX_RATE = 0.19; // Polish CIT

/**
 * Build free cash flow schedule.
 * CAPEX for tooling lands in Year 1 (index 0):
 *   supplier         → full toolCost
 *   customer_amortized → 50% up-front (rest recovered via piece price)
 *   customer_paid    → 0
 * Pre-SOP burn: 3 months × 2% of toolCost (engineering/qualification overhead before SOP).
 */
export function calcCashflow(pnl: YearPnL[], wc: YearWC[], inp: RfqInput): YearCF[] {
  const toolingCapex = inp.toolOwnershipType === 'supplier'
    ? inp.toolCost
    : inp.toolOwnershipType === 'customer_amortized'
    ? inp.toolCost * 0.5
    : 0;
  const preSopBurn = inp.toolCost * 0.02 * 3;
  const capexY1 = safe(toolingCapex + preSopBurn);

  let cumulativeFCF = 0;
  let lossCarryForward = 0;

  return pnl.map((y, idx) => {
    // Apply loss carry-forward then update bucket
    const taxableEbit = y.ebit - lossCarryForward;
    const taxPaid = safe(Math.max(0, taxableEbit) * TAX_RATE);
    lossCarryForward = safe(Math.max(0, lossCarryForward - y.ebit));

    const deltaWC  = wc[idx]?.deltaWC ?? 0;
    const capex    = idx === 0 ? capexY1 : 0;

    const operatingCF = safe(y.ebitda - taxPaid - deltaWC);
    const freeCF      = safe(operatingCF - capex);
    cumulativeFCF = safe(cumulativeFCF + freeCF);

    return { year: y.year, ebitda: y.ebitda, taxPaid, deltaWC, capex, operatingCF, freeCF, cumulativeFCF, lossCarryForward };
  });
}
