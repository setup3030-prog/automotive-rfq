export interface FinancialThresholds {
  hurdleIrr: number;        // fraction, default 0.12
  hurdleRoce: number;       // fraction, default 0.18
  hurdlePaybackMonths: number; // default 36
  wcIntensityWarn: number;  // fraction of annual revenue, default 0.20
  wcIntensityCrit: number;  // default 0.25
  gmWarnPct: number;        // fraction, default 0.15
  gmCritPct: number;        // fraction, default 0.10
}

export const DEFAULT_THRESHOLDS: FinancialThresholds = {
  hurdleIrr: 0.12,
  hurdleRoce: 0.18,
  hurdlePaybackMonths: 36,
  wcIntensityWarn: 0.20,
  wcIntensityCrit: 0.25,
  gmWarnPct: 0.15,
  gmCritPct: 0.10,
};

const STORAGE_KEY = 'rfq-financial-thresholds-v1';

export function loadThresholds(): FinancialThresholds {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THRESHOLDS };
    return { ...DEFAULT_THRESHOLDS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_THRESHOLDS };
  }
}

export function saveThresholds(t: FinancialThresholds): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
}

export type TrafficLight = 'green' | 'yellow' | 'red';

export function flagIrr(irr: number | null, t: FinancialThresholds): TrafficLight {
  if (irr === null) return 'red';
  if (irr >= t.hurdleIrr) return 'green';
  if (irr >= t.hurdleIrr * 0.75) return 'yellow';
  return 'red';
}

export function flagPayback(months: number | null, t: FinancialThresholds): TrafficLight {
  if (months === null) return 'red';
  if (months <= t.hurdlePaybackMonths) return 'green';
  if (months <= t.hurdlePaybackMonths * 1.25) return 'yellow';
  return 'red';
}

export function flagRoce(roce: number, t: FinancialThresholds): TrafficLight {
  if (roce >= t.hurdleRoce) return 'green';
  if (roce >= t.hurdleRoce * 0.75) return 'yellow';
  return 'red';
}

export function flagGm(gm: number, t: FinancialThresholds): TrafficLight {
  if (gm >= t.gmWarnPct) return 'green';
  if (gm >= t.gmCritPct) return 'yellow';
  return 'red';
}

export function flagNpv(npv: number): TrafficLight {
  if (npv > 0) return 'green';
  if (npv > -50000) return 'yellow';
  return 'red';
}

export function flagWcIntensity(peakWc: number, annualRevenue: number, t: FinancialThresholds): TrafficLight {
  if (annualRevenue <= 0) return 'red';
  const ratio = peakWc / annualRevenue;
  if (ratio <= t.wcIntensityWarn) return 'green';
  if (ratio <= t.wcIntensityCrit) return 'yellow';
  return 'red';
}
