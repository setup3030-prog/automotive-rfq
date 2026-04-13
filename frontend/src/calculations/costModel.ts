import type { RfqInput, CostModelResult, RealityGuards, MachineCosts, MaterialCosts, ToolingCosts, LaborCosts, EnergyCosts, OverheadCosts } from '../types/rfq';
import { safe, safeDiv } from '../utils/formatters';

export function calcCostModel(inp: RfqInput): CostModelResult {
  // ─── 3.1 Reality Guards ─────────────────────────────────────────────────────
  const oeeUsed = Math.min(inp.oee, 0.90);
  const scrapUsed = Math.max(inp.scrapRate, 0.02);
  const guards: RealityGuards = {
    oeeUsed,
    scrapUsed,
    oeeWarning: inp.oee > 0.90,
    scrapWarning: inp.scrapRate < 0.02,
    cycleOptimizedWarning:
      inp.cycleTimeActual > 0 &&
      inp.cycleTimeOptimized / inp.cycleTimeActual < 0.75,
  };

  // ─── 3.2 Machine & Process ──────────────────────────────────────────────────
  const partsPerHourGross = safe((3600 / inp.cycleTimeActual) * inp.cavities * oeeUsed);
  const partsPerHourNet = safe(partsPerHourGross * (1 - scrapUsed));
  const requiredHoursYear = safeDiv(inp.volMid, partsPerHourGross);
  const machineUtilization = safeDiv(requiredHoursYear, inp.workingHoursYear);
  const machineCostPerPart = safeDiv(inp.machineHourlyRate, partsPerHourGross);
  const setupCostPerPart = safeDiv(52 * 2 * inp.machineHourlyRate, inp.volMid);
  const maintenancePerPart = safeDiv(inp.machineHourlyRate * 0.05, partsPerHourGross);
  const totalMachineCost = safe(machineCostPerPart + setupCostPerPart + maintenancePerPart);
  const machine: MachineCosts = {
    partsPerHourGross, partsPerHourNet, requiredHoursYear, machineUtilization,
    machineCostPerPart, setupCostPerPart, maintenancePerPart, totalMachineCost,
  };

  // ─── 3.3 Material ────────────────────────────────────────────────────────────
  const netPartWeight = safeDiv(inp.shotWeight, inp.cavities);
  const runnerPerPart = safeDiv(inp.runnerWeight, inp.cavities);
  const grossWeight = safe(netPartWeight + runnerPerPart);
  const vr = inp.virginRegrindRatio;
  const effectiveMatPrice = safe(inp.materialPrice * vr + inp.materialPrice * 0.6 * (1 - vr));
  const grossMaterialCost = safe(grossWeight * effectiveMatPrice);
  const regrindCredit = safe(-(runnerPerPart) * inp.materialPrice * 0.6 * (1 - vr));
  const scrapCost = safe(scrapUsed * grossWeight * effectiveMatPrice);
  const materialWaste = safe(grossWeight * inp.materialPrice * 0.015);
  const totalMaterialCost = safe(grossMaterialCost + regrindCredit + scrapCost + materialWaste);
  const material: MaterialCosts = {
    netPartWeight, runnerPerPart, grossWeight, effectiveMatPrice,
    grossMaterialCost, regrindCredit, scrapCost, materialWaste, totalMaterialCost,
  };

  // ─── 3.4 Tooling ─────────────────────────────────────────────────────────────
  const annualShots = safeDiv(inp.volMid, inp.cavities * (1 - scrapUsed));
  const toolLifeYears = safeDiv(inp.toolLifetime, annualShots);
  const amortizationPerPart = safeDiv(inp.toolCost, inp.toolLifetime * inp.cavities);
  const maintenancePerPartTool = safeDiv(inp.toolCost * inp.toolMaintenanceYear, inp.volMid);
  const financingCostPerPart = safeDiv(inp.toolOwnership * inp.toolCost * 0.08, inp.volMid);
  const totalToolingCost = safe(amortizationPerPart + maintenancePerPartTool + financingCostPerPart);
  const tooling: ToolingCosts = {
    annualShots, toolLifeYears, amortizationPerPart, maintenancePerPartTool,
    financingCostPerPart, totalToolingCost,
  };

  // ─── 3.5 Labor ───────────────────────────────────────────────────────────────
  const directLaborPerPart = safeDiv(inp.laborRate * inp.operatorsPerMachine, partsPerHourNet);
  const indirectLaborPerPart = safe(directLaborPerPart * inp.indirectLaborFactor);
  const totalLaborCost = safe(directLaborPerPart + indirectLaborPerPart);
  const labor: LaborCosts = { directLaborPerPart, indirectLaborPerPart, totalLaborCost };

  // ─── 3.6 Energy ──────────────────────────────────────────────────────────────
  const totalKwh = safe(inp.machineConsumption + inp.auxiliaryEquipment);
  const energyCostPerPart = safeDiv(totalKwh * inp.energyPrice, partsPerHourNet);
  const totalEnergyCost = energyCostPerPart;
  const energy: EnergyCosts = { totalKwh, energyCostPerPart, totalEnergyCost };

  // ─── 3.7 Overhead ────────────────────────────────────────────────────────────
  const fixedOhPerPart = safeDiv(inp.fixedOverhead, inp.volMid);
  const variableOhPerPart = safe(inp.variableOverheadRate * (totalMaterialCost + totalLaborCost + totalEnergyCost));
  const totalOverhead = safe(fixedOhPerPart + variableOhPerPart);
  const overhead: OverheadCosts = { fixedOhPerPart, variableOhPerPart, totalOverhead };

  // ─── 3.8 Total ───────────────────────────────────────────────────────────────
  const totalMfgCost = safe(
    totalMachineCost + totalMaterialCost + totalToolingCost +
    totalLaborCost + totalEnergyCost + totalOverhead +
    inp.packagingCost + inp.logisticsCost
  );

  return { guards, machine, material, tooling, labor, energy, overhead, totalMfgCost };
}
