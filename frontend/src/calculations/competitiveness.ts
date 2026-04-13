import type { RfqInput, CompetitivenessInput, CompetitivenessResult } from '../types/rfq';
import type { PriceStrategyResult } from '../types/rfq';
import { safe, safeDiv } from '../utils/formatters';

function competitiveStatus(
  aggressivePrice: number,
  targetPrice: number,
  walkAwayPrice: number,
  compLow: number,
  compMid: number,
  compHigh: number
): string {
  if (aggressivePrice <= compLow) return '✅ VERY COMPETITIVE';
  if (aggressivePrice <= compMid) return '✅ COMPETITIVE';
  if (targetPrice <= compHigh) return '🟡 MARGINAL';
  if (walkAwayPrice <= compHigh) return '🟡 CHALLENGING';
  return '🔴 NOT COMPETITIVE';
}

export function calcCompetitiveness(
  inp: RfqInput,
  compInp: CompetitivenessInput,
  prices: PriceStrategyResult
): CompetitivenessResult {
  const { competitorPriceLow, competitorPriceHigh, competitorEurRate } = compInp;
  const competitorMid = safe((competitorPriceLow + competitorPriceHigh) / 2);

  const tp = prices.target.price;
  const wp = prices.walkAway.price;
  const ap = prices.aggressive.price;

  const gapTargetVsCompMid = safe(tp - competitorMid);
  const gapAggressiveVsCompLow = safe(ap - competitorPriceLow);
  const maxDiscount = safe(tp - wp);
  const maxDiscountPct = safeDiv(maxDiscount, tp);

  const status = competitiveStatus(ap, tp, wp, competitorPriceLow, competitorMid, competitorPriceHigh);

  const ourPriceEur = safeDiv(tp, inp.eurPlnRate);

  // Positive locationAdvantage = we are MORE expensive (disadvantage)
  // Negative = we are cheaper (advantage)
  const partsPerHourNet = safe(
    (3600 / inp.cycleTimeActual) * inp.cavities *
    Math.min(inp.oee, 0.90) * (1 - Math.max(inp.scrapRate, 0.02))
  );
  const locationAdvantage = safe(
    (safeDiv(inp.laborRate, inp.eurPlnRate) - competitorEurRate) *
    inp.operatorsPerMachine / partsPerHourNet
  );
  const annualSavingsVsWEurope = safe(locationAdvantage * inp.volMid);

  return {
    competitorMid, gapTargetVsCompMid, gapAggressiveVsCompLow,
    maxDiscount, maxDiscountPct, competitiveStatus: status,
    ourPriceEur, locationAdvantage, annualSavingsVsWEurope,
  };
}
