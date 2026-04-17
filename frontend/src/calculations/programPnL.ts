import type { RfqInput, CostModelResult, PriceStrategyResult, YearPnL } from '../types/rfq';
import { safe, safeDiv } from '../utils/formatters';

/**
 * Build a year-by-year P&L for the lifecycle of the program.
 * Selling price = target tier. Volume driven by volumeCurve.
 *
 * Tooling treatment (no double-counting):
 *   customer_paid      → 0 COGS, 0 depreciation, 0 capex (customer owns tool)
 *   customer_amortized → cost in COGS (recovered via piece price), 0 depreciation, 50% capex Y1
 *   supplier           → 0 COGS, depreciation on BS, full capex Y1
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

    // Y1 ramp-up: extra 2pp scrap inflates material cost ~2%
    const rampFactor = year === 1 ? 1.02 : 1.0;

    const cogsMaterial       = safe(baseMat * rampFactor * volumeUnits);
    const cogsLabor          = safe(baseLab * volumeUnits);
    const cogsMachine        = safe(baseMach * volumeUnits);
    const cogsEnergy         = safe(baseEnergy * volumeUnits);
    const cogsOverheadDirect = safe(baseVarOh * volumeUnits);

    // Tooling in COGS only for customer_amortized — avoids triple-counting for supplier
    const cogsToolingAmort = inp.toolOwnershipType === 'customer_amortized'
      ? safe(baseToolAmort * volumeUnits)
      : 0;

    const totalCogs = safe(cogsMaterial + cogsLabor + cogsMachine + cogsEnergy + cogsOverheadDirect + cogsToolingAmort);
    const revenue = safe(price * volumeUnits);
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
