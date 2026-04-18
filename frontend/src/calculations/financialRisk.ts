import type { RfqInput, CostModelResult, PriceStrategyResult, FinancialRiskScenario } from '../types/rfq';
import { calcProgramPnL } from './programPnL';
import { calcWorkingCapital } from './workingCapital';
import { calcCashflow } from './cashflow';
import { calcNPV, calcIRR } from './npv';
import { safe } from '../utils/formatters';

function runScenario(inp: RfqInput, cm: CostModelResult, ps: PriceStrategyResult): { npv: number; irr: number | null; ebitdaY2: number } {
  const pnl  = calcProgramPnL(inp, cm, ps);
  const wc   = calcWorkingCapital(pnl, inp);
  const cf   = calcCashflow(pnl, wc, inp);
  const freeC = cf.map(y => y.freeCF);
  const npv  = calcNPV(freeC, inp.wacc);
  const irr  = calcIRR(freeC);
  const ebitdaY2 = cf.length >= 2 ? cf[1].ebitda : (cf[0]?.ebitda ?? 0);
  return { npv, irr, ebitdaY2 };
}

/**
 * Run one-at-a-time sensitivity shocks and return sorted by |ΔNPV| descending.
 */
export function calcFinancialRisk(
  inp: RfqInput,
  cm: CostModelResult,
  ps: PriceStrategyResult,
  hurdleIrr: number
): FinancialRiskScenario[] {
  const base = runScenario(inp, cm, ps);

  // Helper: shallow-merge overrides and re-run
  function shock(inpOverride: Partial<RfqInput>, cmOverride?: Partial<CostModelResult>): FinancialRiskScenario['deltaNpv'] {
    const newInp = { ...inp, ...inpOverride };
    // For cost model overrides we rebuild cm manually (only material/energy changes need it)
    // Simple approach: adjust by scaling cost model results
    return 0; // placeholder; real impl below
  }
  void shock; // suppress unused warning

  const scenarios: FinancialRiskScenario[] = [];

  // ── Volume Down 20% ────────────────────────────────────────────────────────
  {
    const s = runScenario({ ...inp, volumeCurve: inp.volumeCurve.map(v => v * 0.8) }, cm, ps);
    scenarios.push({
      name: 'Volume −20%',
      deltaNpv: safe(s.npv - base.npv),
      deltaEbitdaY2: safe(s.ebitdaY2 - base.ebitdaY2),
      newIrr: s.irr,
      stillMeetsHurdle: s.irr !== null && s.irr >= hurdleIrr && s.npv > 0,
    });
  }

  // ── Volume Down 40% ────────────────────────────────────────────────────────
  {
    const s = runScenario({ ...inp, volumeCurve: inp.volumeCurve.map(v => v * 0.6) }, cm, ps);
    scenarios.push({
      name: 'Volume −40%',
      deltaNpv: safe(s.npv - base.npv),
      deltaEbitdaY2: safe(s.ebitdaY2 - base.ebitdaY2),
      newIrr: s.irr,
      stillMeetsHurdle: s.irr !== null && s.irr >= hurdleIrr && s.npv > 0,
    });
  }

  // ── Material +15% (only if no pass-through) ────────────────────────────────
  if (!inp.escalationMaterial) {
    // Scale material cost by 1.15 in cost model
    const cmScaled: CostModelResult = {
      ...cm,
      material: { ...cm.material, totalMaterialCost: cm.material.totalMaterialCost * 1.15 },
      totalMfgCost: cm.totalMfgCost + cm.material.totalMaterialCost * 0.15,
    };
    const s = runScenario(inp, cmScaled, ps);
    scenarios.push({
      name: 'Material +15% (unhedged)',
      deltaNpv: safe(s.npv - base.npv),
      deltaEbitdaY2: safe(s.ebitdaY2 - base.ebitdaY2),
      newIrr: s.irr,
      stillMeetsHurdle: s.irr !== null && s.irr >= hurdleIrr && s.npv > 0,
    });
  }

  // ── Energy +30% (only if no escalation clause) ─────────────────────────────
  if (!inp.escalationEnergy) {
    const cmScaled: CostModelResult = {
      ...cm,
      energy: { ...cm.energy, totalEnergyCost: cm.energy.totalEnergyCost * 1.3 },
      totalMfgCost: cm.totalMfgCost + cm.energy.totalEnergyCost * 0.3,
    };
    const s = runScenario(inp, cmScaled, ps);
    scenarios.push({
      name: 'Energy +30% (unhedged)',
      deltaNpv: safe(s.npv - base.npv),
      deltaEbitdaY2: safe(s.ebitdaY2 - base.ebitdaY2),
      newIrr: s.irr,
      stillMeetsHurdle: s.irr !== null && s.irr >= hurdleIrr && s.npv > 0,
    });
  }

  // ── FX EUR/PLN −10% (EUR weakens — revenue in PLN falls) ──────────────────
  {
    const fxFactor = 0.9;
    // Revenue in EUR converts to less PLN: revenue_pln = revenue_eur_portion × new_rate + revenue_pln_portion
    // Simplified: scale price by effective FX impact
    const revenueImpactFactor = 1 - inp.fxEurShareRevenue * (1 - fxFactor) * (1 - inp.fxHedgeRatio);
    const newPrice = ps.target.price * revenueImpactFactor;
    const newPs: PriceStrategyResult = {
      ...ps,
      target: { ...ps.target, price: newPrice },
      walkAway: { ...ps.walkAway, price: ps.walkAway.price * revenueImpactFactor },
      aggressive: { ...ps.aggressive, price: ps.aggressive.price * revenueImpactFactor },
    };
    const s = runScenario(inp, cm, newPs);
    scenarios.push({
      name: 'EUR/PLN −10% (FX)',
      deltaNpv: safe(s.npv - base.npv),
      deltaEbitdaY2: safe(s.ebitdaY2 - base.ebitdaY2),
      newIrr: s.irr,
      stillMeetsHurdle: s.irr !== null && s.irr >= hurdleIrr && s.npv > 0,
    });
  }

  // ── FX EUR/PLN +10% ────────────────────────────────────────────────────────
  {
    const fxFactor = 1.1;
    const revenueImpactFactor = 1 + inp.fxEurShareRevenue * (fxFactor - 1) * (1 - inp.fxHedgeRatio);
    const newPrice = ps.target.price * revenueImpactFactor;
    const newPs: PriceStrategyResult = {
      ...ps,
      target: { ...ps.target, price: newPrice },
      walkAway: { ...ps.walkAway, price: ps.walkAway.price * revenueImpactFactor },
      aggressive: { ...ps.aggressive, price: ps.aggressive.price * revenueImpactFactor },
    };
    const s = runScenario(inp, cm, newPs);
    scenarios.push({
      name: 'EUR/PLN +10% (FX)',
      deltaNpv: safe(s.npv - base.npv),
      deltaEbitdaY2: safe(s.ebitdaY2 - base.ebitdaY2),
      newIrr: s.irr,
      stillMeetsHurdle: s.irr !== null && s.irr >= hurdleIrr && s.npv > 0,
    });
  }

  // ── SOP Delay 3 months ─────────────────────────────────────────────────────
  {
    const delayedCurve = [inp.volumeCurve[0] * 0.75, ...inp.volumeCurve.slice(1)];
    const s = runScenario({ ...inp, volumeCurve: delayedCurve }, cm, ps);
    scenarios.push({
      name: 'SOP Delay 3 months',
      deltaNpv: safe(s.npv - base.npv),
      deltaEbitdaY2: safe(s.ebitdaY2 - base.ebitdaY2),
      newIrr: s.irr,
      stillMeetsHurdle: s.irr !== null && s.irr >= hurdleIrr && s.npv > 0,
    });
  }

  // Sort by |ΔNPV| descending
  return scenarios.sort((a, b) => Math.abs(b.deltaNpv) - Math.abs(a.deltaNpv));
}
