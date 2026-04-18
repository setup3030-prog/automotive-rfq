import { describe, it, expect } from 'vitest';
import { calcProgramPnL } from '../programPnL';
import type { RfqInput, CostModelResult, PriceStrategyResult } from '../../types/rfq';

const mockCm = {
  material: { totalMaterialCost: 2.0 },
  labor: { totalLaborCost: 0.5 },
  machine: { totalMachineCost: 0.8 },
  energy: { totalEnergyCost: 0.1 },
  overhead: { variableOhPerPart: 0.05 },
  tooling: { totalToolingCost: 0.2 },
} as unknown as CostModelResult;

const mockPs = {
  target: { price: 5.0 },
} as unknown as PriceStrategyResult;

const baseInp = {
  lifecycleYears: 3,
  volumeCurve: [100, 100, 100],
  volMid: 10000,
  toolOwnershipType: 'customer_paid',
  toolCost: 50000,
  toolDepreciationYears: 5,
  corporateOverheadAllocationPct: 0.03,
} as unknown as RfqInput;

describe('calcProgramPnL', () => {
  it('generates correct number of years', () => {
    const pnl = calcProgramPnL(baseInp, mockCm, mockPs);
    expect(pnl).toHaveLength(3);
  });

  it('Y1 volume = volMid * curve[0] / 100', () => {
    const pnl = calcProgramPnL(baseInp, mockCm, mockPs);
    expect(pnl[0].volumeUnits).toBe(10000);
  });

  it('Y1 material cost has 2% ramp factor', () => {
    const pnl = calcProgramPnL(baseInp, mockCm, mockPs);
    const y1Mat = pnl[0].cogsMaterial;
    const y2Mat = pnl[1].cogsMaterial;
    expect(y1Mat / y2Mat).toBeCloseTo(1.02, 5);
  });

  it('revenue = price × volume', () => {
    const pnl = calcProgramPnL(baseInp, mockCm, mockPs);
    expect(pnl[0].revenue).toBeCloseTo(5.0 * 10000, 0);
  });

  it('no tooling depreciation for customer_paid', () => {
    const pnl = calcProgramPnL(baseInp, mockCm, mockPs);
    expect(pnl.every(y => y.depreciation === 0)).toBe(true);
  });

  it('tooling depreciation is applied for supplier-owned', () => {
    const supplierInp = { ...baseInp, toolOwnershipType: 'supplier' } as unknown as RfqInput;
    const pnl = calcProgramPnL(supplierInp, mockCm, mockPs);
    // annualDepreciation = 50000 / 5 = 10000
    expect(pnl[0].depreciation).toBeCloseTo(10000, 0);
    expect(pnl[0].ebit).toBeCloseTo(pnl[0].ebitda - 10000, 0);
  });

  it('auto-extends volumeCurve when shorter than lifecycleYears', () => {
    const shortCurveInp = { ...baseInp, lifecycleYears: 5, volumeCurve: [80, 100] } as unknown as RfqInput;
    const pnl = calcProgramPnL(shortCurveInp, mockCm, mockPs);
    expect(pnl).toHaveLength(5);
    expect(pnl[2].volumeUnits).toBe(pnl[4].volumeUnits);
  });

  // FIX 1 — no tooling double-counting
  it('supplier mode: cogsToolingAmort=0, depreciation>0', () => {
    const supplierInp = { ...baseInp, toolOwnershipType: 'supplier' } as unknown as RfqInput;
    const pnl = calcProgramPnL(supplierInp, mockCm, mockPs);
    expect(pnl[0].cogsToolingAmort).toBe(0);
    expect(pnl[0].depreciation).toBeGreaterThan(0);
  });

  it('customer_amortized mode: cogsToolingAmort>0, depreciation=0', () => {
    const amortInp = { ...baseInp, toolOwnershipType: 'customer_amortized' } as unknown as RfqInput;
    const pnl = calcProgramPnL(amortInp, mockCm, mockPs);
    expect(pnl[0].cogsToolingAmort).toBeGreaterThan(0);
    expect(pnl[0].depreciation).toBe(0);
  });

  it('customer_paid mode: both cogsToolingAmort=0 and depreciation=0', () => {
    const pnl = calcProgramPnL(baseInp, mockCm, mockPs);
    expect(pnl[0].cogsToolingAmort).toBe(0);
    expect(pnl[0].depreciation).toBe(0);
  });

  // FIX 4 — escalation pass-through keeps gross profit neutral
  it('material escalation raises Y2 cost by ~3%', () => {
    const escInp = { ...baseInp, escalationMaterial: true, escalationEnergy: false, escalationLaborCpi: false } as unknown as RfqInput;
    const pnl = calcProgramPnL(escInp, mockCm, mockPs);
    // Y2 material cost = baseMat * (1.03)^1 * volume vs Y1 (no ramp on Y2)
    expect(pnl[1].cogsMaterial / pnl[2].cogsMaterial).toBeCloseTo(1 / 1.03, 4);
  });

  it('with escalation on, Y2 price is higher than Y1 price (pass-through applied)', () => {
    const escInp = {
      ...baseInp,
      lifecycleYears: 2,
      volumeCurve: [100, 100],
      escalationMaterial: true,
      escalationEnergy: true,
      escalationLaborCpi: true,
    } as unknown as RfqInput;
    const pnl = calcProgramPnL(escInp, mockCm, mockPs);
    // Y2 effective price = revenue / volumeUnits; should be > base price 5.0
    const y2EffectivePrice = pnl[1].revenue / pnl[1].volumeUnits;
    expect(y2EffectivePrice).toBeGreaterThan(5.0);
  });

  it('with escalation off, Y2 price equals Y1 price', () => {
    const noEscInp = {
      ...baseInp,
      lifecycleYears: 2,
      volumeCurve: [100, 100],
      escalationMaterial: false,
      escalationEnergy: false,
      escalationLaborCpi: false,
    } as unknown as RfqInput;
    const pnl = calcProgramPnL(noEscInp, mockCm, mockPs);
    const y1Price = pnl[0].revenue / pnl[0].volumeUnits;
    const y2Price = pnl[1].revenue / pnl[1].volumeUnits;
    expect(y2Price).toBeCloseTo(y1Price, 6);
  });
});
