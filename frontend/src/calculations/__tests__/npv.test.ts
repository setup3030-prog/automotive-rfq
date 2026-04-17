import { describe, it, expect } from 'vitest';
import { calcNPV, calcIRR } from '../npv';

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
