import type { RfqInput, PriceStrategyMargins, PriceStrategyResult, PricePoint } from '../types/rfq';
import type { CostModelResult } from '../types/rfq';
import { safe, safeDiv } from '../utils/formatters';

function riskLabel(price: number, cost: number, margin: number, type: 'walkAway' | 'target' | 'aggressive'): string {
  if (price < cost) return '🔴 LOSS — DO NOT QUOTE';
  if (type === 'walkAway') {
    if (margin < 0.08) return '🔴 HIGH RISK';
    return '🔴 HIGH RISK — ABSOLUTE MINIMUM';
  }
  if (type === 'target') {
    if (margin < 0.12) return '🟡 MEDIUM RISK';
    if (margin < 0.20) return '🟢 LOW RISK';
    return '🟢 STRONG MARGIN';
  }
  // aggressive
  if (margin < 0.06) return '🔴 HIGH RISK';
  if (margin < 0.12) return '🟡 MEDIUM RISK';
  return '🟡 MEDIUM — WATCH CAREFULLY';
}

function goNoGo(price: number, cost: number, margin: number, marginMin: number, customerTarget: number): string {
  if (price < cost) return '🚫 NO GO — LOSS MAKING';
  if (margin < marginMin) return '🚫 NO GO — BELOW FLOOR';
  if (customerTarget > 0 && price > customerTarget * 1.2) return '⚠ PRICE TOO HIGH — WON\'T WIN';
  return '✅ GO';
}

function calcPoint(
  price: number,
  cost: number,
  inp: RfqInput,
  marginMin: number,
  type: 'walkAway' | 'target' | 'aggressive'
): PricePoint {
  const margin = safeDiv(price - cost, price);
  const grossMarginPerPart = safe(price - cost);
  const vsCustomerTarget = safe(price - inp.targetPrice);
  const annualRevenue = safe(price * inp.volMid);
  const annualProfit = safe(grossMarginPerPart * inp.volMid);
  const lifetimeRevenue = safe(price * inp.volLifetime);
  const fixedOhPerPart = safeDiv(inp.fixedOverhead, inp.volMid);
  const breakEvenVolume = safeDiv(inp.fixedOverhead, grossMarginPerPart + fixedOhPerPart);
  const financingCost = safe(cost * inp.paymentTerms / 365 * 0.06);
  return {
    price, margin, grossMarginPerPart, vsCustomerTarget,
    annualRevenue, annualProfit, lifetimeRevenue, breakEvenVolume, financingCost,
    risk: riskLabel(price, cost, margin, type),
    goNoGo: goNoGo(price, cost, margin, marginMin, inp.targetPrice),
  };
}

export function calcPriceStrategy(
  inp: RfqInput,
  cost: CostModelResult,
  margins: PriceStrategyMargins
): PriceStrategyResult {
  const c = cost.totalMfgCost;
  const walkAwayPrice = safeDiv(c, 1 - margins.marginMin);
  const targetPrice = safeDiv(c, 1 - margins.marginTarget);
  const aggressivePrice = safeDiv(c, 1 - margins.marginAggressive);

  return {
    walkAway: calcPoint(walkAwayPrice, c, inp, margins.marginMin, 'walkAway'),
    target: calcPoint(targetPrice, c, inp, margins.marginMin, 'target'),
    aggressive: calcPoint(aggressivePrice, c, inp, margins.marginMin, 'aggressive'),
  };
}
