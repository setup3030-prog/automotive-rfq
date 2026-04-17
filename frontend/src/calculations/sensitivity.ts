import type { RfqInput, SensitivityPoint, SensitivityResult } from '../types/rfq';
import { safe, safeDiv } from '../utils/formatters';

function goNoGo(margin: number): string {
  if (margin < 0) return '🚫 LOSS';
  if (margin < 0.06) return '🔴 NO GO';
  if (margin < 0.12) return '🟡 MARGINAL';
  return '✅ GO';
}

function costAtParams(
  inp: RfqInput,
  ct: number,
  matPrice: number,
  oee: number,
  energyPrice: number
): number {
  const oeeU = Math.min(oee, 0.90);
  const scrap = Math.max(inp.scrapRate, 0.02);
  const pph = safe((3600 / ct) * inp.cavities * oeeU * (1 - scrap));
  const machCost = safeDiv(inp.machineHourlyRate, pph);
  const matCost = safe((inp.shotWeight / inp.cavities + inp.runnerWeight / inp.cavities) * matPrice);
  const labCost = safeDiv(inp.laborRate * inp.operatorsPerMachine, pph);
  const enCost = safeDiv((inp.machineConsumption + inp.auxiliaryEquipment) * energyPrice, pph);
  const toolAmort = safeDiv(inp.toolCost, inp.toolLifetime * inp.cavities);
  const toolMaint = safeDiv(inp.toolCost * inp.toolMaintenanceYear, inp.volMid);
  const fixedOh = safeDiv(inp.fixedOverhead, inp.volMid);
  const varOh = safe(inp.variableOverheadRate * (matCost + labCost + enCost));
  return safe(machCost + matCost + labCost + enCost + toolAmort + toolMaint + fixedOh + varOh + inp.packagingCost + inp.logisticsCost);
}

// Base value must come from inp so that isBase tracks the live input, not a stale constant.
// If the actual base value is not in the predefined range array, inject it before sorting.
function buildPoints(
  values: number[],
  baseValue: number,
  costFn: (v: number) => number,
  customerTarget: number
): SensitivityPoint[] {
  const allValues = values.some((v) => Math.abs(v - baseValue) < 1e-9)
    ? values
    : [...values, baseValue].sort((a, b) => a - b);

  const baseCost = costFn(baseValue);
  return allValues.map((v) => {
    const cost = costFn(v);
    const vsBase = safe(cost - baseCost);
    const marginAtTarget = safeDiv(customerTarget - cost, customerTarget);
    return {
      param: v,
      cost,
      vsBase,
      marginAtTarget,
      goNoGo: goNoGo(marginAtTarget),
      isBase: Math.abs(v - baseValue) < 1e-9,
    };
  });
}

export function calcSensitivity(inp: RfqInput): SensitivityResult {
  const ct = inp.cycleTimeActual;
  const mp = inp.materialPrice;
  const oee = Math.min(inp.oee, 0.90);
  const ep = inp.energyPrice;
  const cTarget = inp.targetPrice;

  // 8.1 Cycle Time — base from live input
  const ctValues = [22, 25, 28, 30, 32, 35, 38, 42, 48, 55];
  const cycleTime = buildPoints(
    ctValues, ct,
    (v) => costAtParams(inp, v, mp, oee, ep),
    cTarget
  );

  // 8.2 Material Price — relative multiplier; base is always 1.00 (= current price)
  const matPcts = [0.70, 0.80, 0.90, 0.95, 1.00, 1.05, 1.10, 1.20, 1.30, 1.50];
  const materialPrice = buildPoints(
    matPcts, 1.00,
    (v) => costAtParams(inp, ct, mp * v, oee, ep),
    cTarget
  );

  // 8.3 OEE — base from live input
  const oeeValues = [0.60, 0.65, 0.70, 0.75, 0.80, 0.82, 0.85, 0.88, 0.90, 0.92];
  const oeePoints = buildPoints(
    oeeValues, inp.oee,
    (v) => costAtParams(inp, ct, mp, v, ep),
    cTarget
  );

  // 8.4 Energy Price — base from live input
  const epValues = [0.40, 0.50, 0.60, 0.65, 0.72, 0.80, 0.90, 1.00, 1.20, 1.50];
  const energyPrice = buildPoints(
    epValues, ep,
    (v) => costAtParams(inp, ct, mp, oee, v),
    cTarget
  );

  return { cycleTime, materialPrice, oee: oeePoints, energyPrice };
}
