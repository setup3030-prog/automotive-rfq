import { describe, it, expect } from 'vitest';
import { calcWorkingCapital, peakNetWC } from '../workingCapital';
import type { YearPnL, RfqInput } from '../../types/rfq';

const basePnL: YearPnL[] = [
  {
    year: 1, volumeUnits: 100000, revenue: 500000,
    cogsMaterial: 150000, cogsLabor: 50000, cogsMachine: 40000,
    cogsEnergy: 10000, cogsOverheadDirect: 5000, cogsToolingAmort: 10000,
    grossProfit: 235000, grossMarginPct: 0.47, corporateOverheadAlloc: 15000,
    ebitda: 220000, depreciation: 0, ebit: 220000, ebitPct: 0.44,
  },
  {
    year: 2, volumeUnits: 100000, revenue: 500000,
    cogsMaterial: 150000, cogsLabor: 50000, cogsMachine: 40000,
    cogsEnergy: 10000, cogsOverheadDirect: 5000, cogsToolingAmort: 10000,
    grossProfit: 235000, grossMarginPct: 0.47, corporateOverheadAlloc: 15000,
    ebitda: 220000, depreciation: 0, ebit: 220000, ebitPct: 0.44,
  },
];

const baseInp = {
  paymentTerms: 60,  // DSO = 60 days
  dpoDays: 45,
  dioDays: 30,
} as unknown as RfqInput;

describe('calcWorkingCapital', () => {
  it('calculates receivables correctly (DSO=60)', () => {
    const wc = calcWorkingCapital(basePnL, baseInp);
    // receivables = revenue * DSO / 360 = 500000 * 60 / 360 ≈ 83333
    expect(wc[0].receivables).toBeCloseTo(83333, 0);
  });

  it('calculates payables correctly (DPO=45)', () => {
    const wc = calcWorkingCapital(basePnL, baseInp);
    // payables = cogsMaterial * DPO / 360 = 150000 * 45 / 360 = 18750
    expect(wc[0].payables).toBeCloseTo(18750, 0);
  });

  it('deltaWC = 0 when WC is flat year-to-year', () => {
    const wc = calcWorkingCapital(basePnL, baseInp);
    expect(wc[1].deltaWC).toBeCloseTo(0, 1);
  });

  it('netWC = receivables + inventory - payables', () => {
    const wc = calcWorkingCapital(basePnL, baseInp);
    expect(wc[0].netWC).toBeCloseTo(wc[0].receivables + wc[0].inventory - wc[0].payables, 1);
  });
});

describe('peakNetWC', () => {
  it('returns the maximum netWC across all years', () => {
    const wc = [
      { year: 1, receivables: 0, inventory: 0, payables: 0, netWC: 50000, deltaWC: 0 },
      { year: 2, receivables: 0, inventory: 0, payables: 0, netWC: 80000, deltaWC: 0 },
      { year: 3, receivables: 0, inventory: 0, payables: 0, netWC: 70000, deltaWC: 0 },
    ];
    expect(peakNetWC(wc)).toBe(80000);
  });

  it('returns 0 for empty array', () => {
    expect(peakNetWC([])).toBe(0);
  });
});
