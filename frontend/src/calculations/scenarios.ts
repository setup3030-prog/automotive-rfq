import type { RfqInput, ScenariosInput, ScenarioParams, ScenarioResult, PriceStrategyMargins } from '../types/rfq';
import { safe, safeDiv } from '../utils/formatters';
import { calcCostModel } from './costModel';

function goNoGo(margin: number): string {
  if (margin < 0.05) return '🚫 NO GO';
  if (margin < 0.10) return '⚠ MARGINAL';
  return '✅ GO';
}

function calcScenario(inp: RfqInput, s: ScenarioParams, name: string, margins: PriceStrategyMargins): ScenarioResult {
  // Build a modified RfqInput for this scenario and run the full cost model
  // so that indirect labor, runner material, setup, maintenance are all included.
  const scenarioInp: RfqInput = {
    ...inp,
    volMid: s.volume,
    cycleTimeActual: s.cycleTime,
    oee: s.oee,
    scrapRate: s.scrapRate,
    materialPrice: s.materialPrice,
    machineHourlyRate: s.machineRate,
    laborRate: s.laborRate,
    energyPrice: s.energyPrice,
    fixedOverhead: s.fixedOverhead,
  };

  const cm = calcCostModel(scenarioInp);
  const mfgCost = cm.totalMfgCost;
  const sellingPrice = safeDiv(mfgCost, 1 - margins.marginTarget);
  const margin = safeDiv(sellingPrice - mfgCost, sellingPrice);
  const annualRevenue = safe(sellingPrice * s.volume);
  const annualProfit = safe((sellingPrice - mfgCost) * s.volume);

  return { name, params: s, mfgCost, sellingPrice, margin, annualRevenue, annualProfit, goNoGo: goNoGo(margin) };
}

export function calcScenarios(inp: RfqInput, scenarios: ScenariosInput, margins: PriceStrategyMargins): ScenarioResult[] {
  return [
    calcScenario(inp, scenarios.best, 'Best Case', margins),
    calcScenario(inp, scenarios.realistic, 'Realistic', margins),
    calcScenario(inp, scenarios.worst, 'Worst Case', margins),
  ];
}
