import type { RfqInput, CostModelResult, PriceStrategyResult, YearPnL } from '../types/rfq';
import { safe, safeDiv } from '../utils/formatters';

const MATERIAL_INFLATION = 0.03;
const ENERGY_INFLATION   = 0.04;
const LABOR_CPI          = 0.025;

/**
 * Build a year-by-year P&L for the lifecycle of the program.
 * Selling price = target tier. Volume driven by volumeCurve.
 *
 * Tooling treatment (no double-counting):
 *   customer_paid      → 0 COGS, 0 depreciation, 0 capex (customer owns tool)
 *   customer_amortized → cost in COGS (recovered via piece price), 0 depreciation, 50% capex Y1
 *   supplier           → 0 COGS, depreciation on BS, full capex Y1
 *
 * Escalation: cost escalation applies from Y2 onward compounded per year.
 * Price escalates proportionally only for flagged cost lines (pass-through neutrality).
 */
export function calcProgramPnL(
  inp: RfqInput,
  cm: CostModelResult,
  ps: PriceStrategyResult
): YearPnL[] {
  const price = ps.target.price;
  const years = Math.max(1, Math.round(inp.lifecycleYears));
  const curve = inp.volumeCurve.length >= years
    ? inp.volumeCurve.slice(0, years)
    : [...inp.volumeCurve, ...Array(years - inp.volumeCurve.length).fill(inp.volumeCurve[inp.volumeCurve.length - 1] ?? 100)];

  // Base cost components per part (at volMid, from the full cost model)
  const baseMat    = cm.material.totalMaterialCost;
  const baseLab    = cm.labor.totalLaborCost;
  const baseMach   = cm.machine.totalMachineCost;
  const baseEnergy = cm.energy.totalEnergyCost;
  const baseVarOh  = cm.overhead.variableOhPerPart;
  const baseToolAmort = cm.tooling.totalToolingCost;

  // Annual tooling depreciation — balance-sheet only for supplier-owned tools
  const annualDepreciation = inp.toolOwnershipType === 'supplier'
    ? safeDiv(inp.toolCost, inp.toolDepreciationYears)
    : 0;

  return curve.map((curvePct, idx) => {
    const year = idx + 1;
    const volumeUnits = safe(inp.volMid * curvePct / 100);

    // Compound escalation factor from Y2 onward (year 1 = no escalation)
    const n = Math.max(0, year - 1);
    const matFactor   = inp.escalationMaterial  ? Math.pow(1 + MATERIAL_INFLATION, n) : 1;
    const energyFactor= inp.escalationEnergy    ? Math.pow(1 + ENERGY_INFLATION,   n) : 1;
    const laborFactor = inp.escalationLaborCpi  ? Math.pow(1 + LABOR_CPI,          n) : 1;

    // Y1 ramp-up: extra 2pp scrap inflates material cost ~2%
    const rampFactor = year === 1 ? 1.02 : 1.0;

    const cogsMaterial       = safe(baseMat * rampFactor * matFactor * volumeUnits);
    const cogsLabor          = safe(baseLab * laborFactor * volumeUnits);
    const cogsMachine        = safe(baseMach * volumeUnits);
    const cogsEnergy         = safe(baseEnergy * energyFactor * volumeUnits);
    const cogsOverheadDirect = safe(baseVarOh * volumeUnits);

    // Tooling in COGS only for customer_amortized — avoids triple-counting for supplier
    const cogsToolingAmort = inp.toolOwnershipType === 'customer_amortized'
      ? safe(baseToolAmort * volumeUnits)
      : 0;

    // Price escalation: pass-through of flagged cost lines keeps margin neutral
    // Weight each escalated cost line by its base share of total base cost
    const totalBase = baseMat + baseLab + baseEnergy;
    const priceFactor = totalBase > 0
      ? 1
        + (inp.escalationMaterial ? (baseMat   / totalBase) * (matFactor   - 1) : 0)
        + (inp.escalationLaborCpi ? (baseLab   / totalBase) * (laborFactor - 1) : 0)
        + (inp.escalationEnergy   ? (baseEnergy/ totalBase) * (energyFactor - 1) : 0)
      : 1;

    const revenue = safe(price * priceFactor * volumeUnits);

    const totalCogs = safe(cogsMaterial + cogsLabor + cogsMachine + cogsEnergy + cogsOverheadDirect + cogsToolingAmort);
    const grossProfit = safe(revenue - totalCogs);
    const grossMarginPct = safeDiv(grossProfit, revenue);
    const corporateOverheadAlloc = safe(revenue * inp.corporateOverheadAllocationPct);
    const ebitda = safe(grossProfit - corporateOverheadAlloc);
    const depreciation = safe(annualDepreciation);
    const ebit = safe(ebitda - depreciation);
    const ebitPct = safeDiv(ebit, revenue);

    return {
      year, volumeUnits, revenue,
      cogsMaterial, cogsLabor, cogsMachine, cogsEnergy, cogsOverheadDirect, cogsToolingAmort,
      grossProfit, grossMarginPct, corporateOverheadAlloc, ebitda, depreciation, ebit, ebitPct,
    };
  });
}
