import type { RfqInput, ScenariosInput, ScenarioParams, ScenarioResult } from '../types/rfq';
import { safe, safeDiv } from '../utils/formatters';

const SELLING_MARGIN = 0.18;

function goNoGo(margin: number): string {
  if (margin < 0.05) return '🚫 NO GO';
  if (margin < 0.10) return '⚠ MARGINAL';
  return '✅ GO';
}

function calcScenario(inp: RfqInput, s: ScenarioParams, name: string): ScenarioResult {
  const oeeS = Math.min(s.oee, 0.90);
  const scrapS = Math.max(s.scrapRate, 0.02);
  const netPartsPerHour = safe(
    (3600 / s.cycleTime) * inp.cavities * oeeS * (1 - scrapS)
  );

  const matCost = safe((inp.shotWeight / inp.cavities + inp.runnerWeight / inp.cavities) * s.materialPrice);
  const machineCost = safeDiv(s.machineRate, netPartsPerHour);
  const laborCost = safeDiv(s.laborRate * inp.operatorsPerMachine, netPartsPerHour);
  const energyCost = safeDiv((inp.machineConsumption + inp.auxiliaryEquipment) * s.energyPrice, netPartsPerHour);
  const toolAmort = safeDiv(inp.toolCost, inp.toolLifetime * inp.cavities);
  const toolMaint = safeDiv(inp.toolCost * inp.toolMaintenanceYear, s.volume);
  const fixedOh = safeDiv(s.fixedOverhead, s.volume);
  const varOhBase = matCost + laborCost + energyCost;
  const varOh = safe(inp.variableOverheadRate * varOhBase);

  const mfgCost = safe(
    matCost + machineCost + laborCost + energyCost +
    toolAmort + toolMaint + fixedOh + varOh +
    inp.packagingCost + inp.logisticsCost
  );

  const sellingPrice = safeDiv(mfgCost, 1 - SELLING_MARGIN);
  const margin = safeDiv(sellingPrice - mfgCost, sellingPrice);
  const annualRevenue = safe(sellingPrice * s.volume);
  const annualProfit = safe((sellingPrice - mfgCost) * s.volume);

  return { name, params: s, mfgCost, sellingPrice, margin, annualRevenue, annualProfit, goNoGo: goNoGo(margin) };
}

export function calcScenarios(inp: RfqInput, scenarios: ScenariosInput): ScenarioResult[] {
  return [
    calcScenario(inp, scenarios.best, 'Best Case'),
    calcScenario(inp, scenarios.realistic, 'Realistic'),
    calcScenario(inp, scenarios.worst, 'Worst Case'),
  ];
}
