import { describe, it, expect } from 'vitest';
import { calcNPV, calcIRR, calcNpv } from '../npv';
import type { YearCF, YearPnL, YearWC, RfqInput } from '../../types/rfq';

describe('calcNPV', () => {
  it('discounts cash flows correctly at 10% WACC', () => {
    // CF: [-1000, 300, 400, 500, 600] at 10%
    // = -1000/1.1 + 300/1.21 + 400/1.331 + 500/1.4641 + 600/1.61051 ≈ 353.43
    const npv = calcNPV([-1000, 300, 400, 500, 600], 0.10);
    expect(npv).toBeCloseTo(353.43, 1);
  });

  it('returns 0 for empty cashflows', () => {
    expect(calcNPV([], 0.10)).toBe(0);
  });

  it('returns undiscounted sum at rate=0', () => {
    expect(calcNPV([100, 200, 300], 0)).toBeCloseTo(600, 6);
  });
});

describe('calcIRR', () => {
  it('finds IRR for standard investment', () => {
    const irr = calcIRR([-1000, 300, 400, 500, 600]);
    expect(irr).not.toBeNull();
    expect(irr!).toBeCloseTo(0.2489, 3);
  });

  it('returns null when first cash flow is not negative', () => {
    expect(calcIRR([100, -200, 300])).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(calcIRR([])).toBeNull();
  });

  it('NPV at IRR is approximately zero', () => {
    const cfs = [-500, 150, 200, 250];
    const irr = calcIRR(cfs);
    expect(irr).not.toBeNull();
    const npvAtIrr = calcNPV(cfs, irr!);
    expect(Math.abs(npvAtIrr)).toBeLessThan(0.01);
  });
});

// FIX 2 — ROCE uses EBIT (not EBITDA)
describe('calcNpv — ROCE and hurdle', () => {
  const makeCF = (freeCF: number): YearCF => ({
    year: 1, ebitda: 50000, taxPaid: 9500, deltaWC: 0, capex: 0,
    operatingCF: 40500, freeCF, cumulativeFCF: freeCF, lossCarryForward: 0,
  });
  const makePnL = (ebit: number, ebitda: number): YearPnL => ({
    year: 1, volumeUnits: 100000, revenue: 500000,
    cogsMaterial: 200000, cogsLabor: 50000, cogsMachine: 40000,
    cogsEnergy: 10000, cogsOverheadDirect: 5000, cogsToolingAmort: 0,
    grossProfit: 195000, grossMarginPct: 0.39, corporateOverheadAlloc: 15000,
    ebitda, depreciation: ebitda - ebit, ebit, ebitPct: ebit / 500000,
  });
  const makeWC = (): YearWC => ({ year: 1, receivables: 0, inventory: 0, payables: 0, netWC: 0, deltaWC: 0 });
  const makeInp = (): RfqInput => ({
    wacc: 0.09, toolOwnershipType: 'customer_paid', toolCost: 0, toolDepreciationYears: 5,
    ebitdaAssetBase: 0,
  } as unknown as RfqInput);

  it('ROCE uses EBIT, not EBITDA', () => {
    const ebit = 80000;
    const ebitda = 100000; // depreciation = 20000
    const cf = [makeCF(40000)];
    const pnl = [makePnL(ebit, ebitda)];
    const wc = [makeWC()];
    const inp = makeInp();
    const result = calcNpv(cf, pnl, wc, inp, 0.12);
    // capitalEmployed = max(0 + 0 + 0, 1) = 1; roceY3 = ebit / 1
    // We just verify it's based on ebit, not ebitda
    expect(result.roceY3).toBeCloseTo(ebit / 1, 0);
    expect(result.roceY3).not.toBeCloseTo(ebitda / 1, 0);
  });

  // FIX 3 — single hurdle source: meetsHurdle uses passed hurdleIrr
  it('meetsHurdle=true when IRR >= hurdleIrr AND npv>0', () => {
    // freeCF [-1000, 1500] → IRR = 50%; NPV at WACC=9% > 0
    const cfs: YearCF[] = [
      { year: 1, ebitda: 0, taxPaid: 0, deltaWC: 0, capex: 1000, operatingCF: 0, freeCF: -1000, cumulativeFCF: -1000, lossCarryForward: 0 },
      { year: 2, ebitda: 1500, taxPaid: 0, deltaWC: 0, capex: 0, operatingCF: 1500, freeCF: 1500, cumulativeFCF: 500, lossCarryForward: 0 },
    ];
    const pnl = [makePnL(50, 60), makePnL(50, 60)];
    const wc = [makeWC(), makeWC()];
    const inp = makeInp();
    const resultHighHurdle = calcNpv(cfs, pnl, wc, inp, 0.99);
    const resultLowHurdle  = calcNpv(cfs, pnl, wc, inp, 0.01);
    expect(resultHighHurdle.meetsHurdle).toBe(false);
    expect(resultLowHurdle.meetsHurdle).toBe(true);
  });
});
