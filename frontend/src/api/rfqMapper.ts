import type { RfqInput } from '../types/rfq';

export interface BackendRFQInput {
  rfq_name: string;
  customer: string | undefined;
  part_number: string | undefined;
  cycle_time: number;
  cavities: number;
  oee: number;                   // percent 1–99.9
  material_price_per_kg: number;
  shot_weight: number;           // kg per finished part
  scrap_rate: number;            // percent 0–50
  annual_volume: number;
  tool_cost: number;
  machine_hourly_rate: number;
  labor_cost_per_hour: number;
  energy_cost_per_hour: number;
}

function require(value: number, name: string): number {
  if (!isFinite(value) || isNaN(value)) throw new Error(`RFQ mapper: "${name}" is missing or NaN`);
  if (value <= 0) throw new Error(`RFQ mapper: "${name}" must be > 0, got ${value}`);
  return value;
}

/** Map frontend RfqInput (fractions, ~70 fields) → backend RFQInput (percents, 12 fields). */
export function toBackendRFQInput(inp: RfqInput): BackendRFQInput {
  return {
    rfq_name: inp.projectName || 'New RFQ',
    customer: inp.customerName || undefined,
    part_number: inp.partNumber || undefined,
    cycle_time: require(inp.cycleTimeActual, 'cycleTimeActual'),
    cavities: require(inp.cavities, 'cavities'),
    oee: require(inp.oee * 100, 'oee'),                              // fraction → percent
    material_price_per_kg: require(inp.materialPrice, 'materialPrice'),
    shot_weight: require(inp.shotWeight / inp.cavities, 'shotWeight/cavities'), // per part
    scrap_rate: require(inp.scrapRate * 100, 'scrapRate'),            // fraction → percent
    annual_volume: require(inp.volMid, 'volMid'),
    tool_cost: inp.toolOwnership === 1 ? inp.toolCost : 0,           // 0 if customer-owned
    machine_hourly_rate: require(inp.machineHourlyRate, 'machineHourlyRate'),
    labor_cost_per_hour: require(inp.laborRate * inp.operatorsPerMachine, 'laborRate'),
    energy_cost_per_hour: require(
      (inp.machineConsumption + inp.auxiliaryEquipment) * inp.energyPrice,
      'energyCostPerHour'
    ),
  };
}
