import { describe, it, expect } from 'vitest';
import { calcCashflow } from '../cashflow';
import type { YearPnL, YearWC, RfqInput } from '../../types/rfq';

const makeWC = (year: number): YearWC => ({ year, receivables: 0, inventory: 0, payables: 0, netWC: 0, deltaWC: 0 });

const baseInp = {
  toolOwnershipType: 'customer_paid',
  toolCost: 0,
  taxRate: 0.19,
} as unknown as RfqInput;

function makePnL(year: number, ebit: number, ebitda: number): YearPnL {
  return {
    year, volumeUnits: 100000, revenue: 500000,
    cogsMaterial: 200000, cogsLabor: 50000, cogsMachine: 40000,
    cogsEnergy: 10000, cogsOverheadDirect: 5000, cogsToolingAmort: 0,
    grossProfit: 195000, grossMarginPct: 0.39, corporateOverheadAlloc: 15000,
    ebitda, depreciation: ebitda - ebit, ebit, ebitPct: ebit / 500000,
  };
}

describe('calcCashflow', () => {
  it('taxPaid = ebit * taxRate when no carry-forward', () => {
    const pnl = [makePnL(1, 100000, 120000)];
    const wc  = [makeWC(1)];
    const cf  = calcCashflow(pnl, wc, baseInp);
    expect(cf[0].taxPaid).toBeCloseTo(100000 * 0.19, 0);
  });

  it('no tax when ebit < 0', () => {
    const pnl = [makePnL(1, -50000, -30000)];
    const cf  = calcCashflow(pnl, [makeWC(1)], baseInp);
    expect(cf[0].taxPaid).toBe(0);
  });

  // FIX 6 — loss carry-forward tax shield
  it('Y1 loss reduces Y2 taxable income (carry-forward)', () => {
    const pnl = [
      makePnL(1, -40000, -20000),  // Y1 loss of 40k
      makePnL(2, 100000, 120000),  // Y2 profit of 100k
    ];
    const wc = [makeWC(1), makeWC(2)];
    const cf = calcCashflow(pnl, wc, baseInp);

    // Y2 taxable = 100000 - 40000 = 60000; tax = 60000 * 0.19 = 11400
    expect(cf[1].taxPaid).toBeCloseTo(60000 * 0.19, 0);
    // Without carry-forward it would be 100000 * 0.19 = 19000
    expect(cf[1].taxPaid).toBeLessThan(100000 * 0.19);
  });

  it('lossCarryForward is zero after loss is fully absorbed', () => {
    const pnl = [
      makePnL(1, -20000, 0),
      makePnL(2, 50000, 70000),
    ];
    const cf = calcCashflow(pnl, [makeWC(1), makeWC(2)], baseInp);
    expect(cf[1].lossCarryForward).toBe(0);
  });

  it('pre-SOP burn (3 * 2% toolCost) adds to Y1 capex', () => {
    const inp = { ...baseInp, toolCost: 100000 } as unknown as RfqInput;
    const pnl = [makePnL(1, 50000, 70000)];
    const cf  = calcCashflow(pnl, [makeWC(1)], inp);
    // preSopBurn = 100000 * 0.02 * 3 = 6000; toolingCapex = 0 (customer_paid); total capex = 6000
    expect(cf[0].capex).toBeCloseTo(6000, 0);
  });
});
