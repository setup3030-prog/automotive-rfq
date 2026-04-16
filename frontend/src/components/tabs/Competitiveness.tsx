import React, { useState } from 'react';
import { useRfq } from '../../context/RfqContext';
import { InputField } from '../ui/InputField';
import { SectionHeader } from '../ui/SectionHeader';
import { StatusBadge } from '../ui/StatusBadge';
import { fmtPrice, fmtPct, fmtNum } from '../../utils/formatters';
import { PriceComparisonChart } from '../charts/PriceComparisonChart';
import { analyzeCompetitors } from '../../api/client';
import type { CountryEstimate } from '../../api/client';

export function Competitiveness() {
  const { state, computed, dispatch } = useRfq();
  const { competitiveness: comp, priceStrategy: ps, costModel: cm } = computed;
  const ci = state.competitiveness;
  const cur = state.input.currency;

  function setComp(payload: Partial<typeof ci>) {
    dispatch({ type: 'SET_COMPETITIVENESS', payload });
  }

  // ── AI Competitor Estimation ──────────────────────────────────
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<{ countries: CountryEstimate[]; summary: string } | null>(null);

  const FLAG: Record<string, string> = { DE: '🇩🇪', CZ: '🇨🇿', SK: '🇸🇰', RO: '🇷🇴' };

  const handleAiEstimate = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const inp = state.input;
      const result = await analyzeCompetitors({
        cycle_time_s: inp.cycleTimeActual,
        cavities: inp.cavities,
        oee_pct: inp.oee * 100,
        shot_weight_kg: inp.shotWeight,
        material_grade: inp.materialGrade,
        material_price_eur: inp.materialPrice / inp.eurPlnRate,
        annual_volume: inp.volMid,
        tool_cost_eur: inp.toolCost / inp.eurPlnRate,
        eur_rate: inp.eurPlnRate,
      });
      setAiResult(result);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'AI estimation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyAi = () => {
    if (!aiResult) return;
    const inp = state.input;
    const lows = aiResult.countries.map((c) => c.est_price_low_eur);
    const highs = aiResult.countries.map((c) => c.est_price_high_eur);
    const minPrice = Math.min(...lows) * inp.eurPlnRate;
    const maxPrice = Math.max(...highs) * inp.eurPlnRate;
    setComp({ competitorPriceLow: parseFloat(minPrice.toFixed(4)), competitorPriceHigh: parseFloat(maxPrice.toFixed(4)) });
  };

  // Pricing Ladder rows
  const ladderRows = [
    { name: 'Competitor LOW', price: ci.competitorPriceLow, rowColor: 'text-red-300' },
    { name: 'Competitor MID', price: comp.competitorMid, rowColor: 'text-orange-300' },
    { name: 'Competitor HIGH', price: ci.competitorPriceHigh, rowColor: 'text-yellow-300' },
    { name: 'Customer Target', price: state.input.targetPrice, rowColor: 'text-purple-300' },
    { name: 'Our Aggressive', price: ps.aggressive.price, rowColor: 'text-yellow-400' },
    { name: 'Our Target', price: ps.target.price, rowColor: 'text-green-400' },
    { name: 'Our Walk-Away', price: ps.walkAway.price, rowColor: 'text-red-400' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-100">Competitiveness</h1>
        <p className="text-xs text-slate-400">Market positioning vs competitors. Competitor data is editable.</p>
      </div>

      {/* Status banner */}
      <div className="flex items-center gap-3 bg-slate-800/60 rounded-lg p-4">
        <span className="text-sm text-slate-400">Competitive Status:</span>
        <StatusBadge text={comp.competitiveStatus} size="lg" />
      </div>

      {/* AI Competitor Estimation */}
      <div className="bg-slate-800/60 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <SectionHeader title="AI Competitor Estimate" />
            <p className="text-xs text-slate-400 -mt-2">
              Claude AI models competitor prices for DE, CZ, SK, RO using benchmark rates and your RFQ parameters.
            </p>
          </div>
          <button
            onClick={handleAiEstimate}
            disabled={aiLoading}
            className="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed border border-indigo-500 text-white text-sm rounded-lg font-medium transition-colors"
          >
            {aiLoading ? 'Estimating…' : 'Estimate with AI'}
          </button>
        </div>

        {aiError && (
          <div className="bg-red-900/30 border border-red-700 rounded px-3 py-2 text-xs text-red-300">
            {aiError}
          </div>
        )}

        {aiResult && (
          <div className="space-y-3">
            {/* Country cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              {aiResult.countries.map((c) => (
                <div key={c.code} className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{FLAG[c.code] ?? '🏭'}</span>
                    <span className="font-semibold text-slate-100 text-sm">{c.country}</span>
                  </div>
                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>Machine</span><span>{c.machine_rate_eur} EUR/h</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Labor</span><span>{c.labor_rate_eur} EUR/h</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Est. cost</span><span className="text-slate-300">{c.est_cost_eur.toFixed(4)} EUR</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-700 pt-1 mt-1">
                      <span className="text-slate-300 font-semibold">Price range</span>
                      <span className="text-blue-300 font-semibold">
                        {c.est_price_low_eur.toFixed(3)}–{c.est_price_high_eur.toFixed(3)} EUR
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>In {cur}</span>
                      <span className="text-slate-300">
                        {fmtPrice(c.est_price_low_eur * state.input.eurPlnRate)}–{fmtPrice(c.est_price_high_eur * state.input.eurPlnRate)}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 italic leading-tight">{c.rationale}</p>
                </div>
              ))}
            </div>

            {/* Summary + apply */}
            {aiResult.summary && (
              <div className="bg-indigo-900/20 border border-indigo-700/40 rounded px-3 py-2 text-xs text-indigo-300">
                {aiResult.summary}
              </div>
            )}
            <button
              onClick={handleApplyAi}
              className="px-3 py-1.5 bg-green-700 hover:bg-green-600 border border-green-600 text-white text-xs rounded font-medium transition-colors"
            >
              Apply to Comparison (set LOW / HIGH from AI range)
            </button>
          </div>
        )}
      </div>

      {/* Competitor inputs */}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="Competitor Data (editable)" />
        <div className="grid grid-cols-3 gap-4">
          <InputField
            label="Competitor Price LOW"
            value={ci.competitorPriceLow}
            onChange={(v) => setComp({ competitorPriceLow: parseFloat(v) || 0 })}
            type="number" step="0.01" unit={`${cur}/pc`}
          />
          <InputField
            label="Competitor Price HIGH"
            value={ci.competitorPriceHigh}
            onChange={(v) => setComp({ competitorPriceHigh: parseFloat(v) || 0 })}
            type="number" step="0.01" unit={`${cur}/pc`}
          />
          <InputField
            label="Competitor Labor Rate"
            value={ci.competitorEurRate}
            onChange={(v) => setComp({ competitorEurRate: parseFloat(v) || 0 })}
            type="number" step="0.01" unit="EUR/h"
            tooltip="W. European competitor direct labor rate in EUR/h"
          />
        </div>
      </div>

      {/* Key gaps */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Competitor Mid', value: `${fmtPrice(comp.competitorMid)} ${cur}`, color: '' },
          { label: 'Target vs Comp Mid', value: `${comp.gapTargetVsCompMid >= 0 ? '+' : ''}${fmtPrice(comp.gapTargetVsCompMid)} ${cur}`, color: comp.gapTargetVsCompMid <= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Max Discount', value: `${fmtPrice(comp.maxDiscount)} ${cur}`, color: '' },
          { label: 'Max Discount %', value: fmtPct(comp.maxDiscountPct), color: '' },
        ].map((k) => (
          <div key={k.label} className="bg-slate-800/60 rounded-lg p-3">
            <div className="text-xs text-slate-400 mb-1">{k.label}</div>
            <div className={`font-mono font-bold text-lg ${k.color || 'text-slate-100'}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Location Advantage */}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="Currency & Location Advantage" />
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-slate-400 mb-1">Our Price (EUR)</div>
            <div className="font-mono text-blue-300 font-bold">{fmtPrice(comp.ourPriceEur)} EUR</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Labor Advantage/Part</div>
            <div className={`font-mono font-bold ${comp.locationAdvantage < 0 ? 'text-green-400' : 'text-red-400'}`}>
              {comp.locationAdvantage < 0 ? '✅ ' : '⚠ '}
              {fmtPrice(Math.abs(comp.locationAdvantage))} {cur}
              {comp.locationAdvantage < 0 ? ' (our advantage)' : ' (their advantage)'}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Annual Savings vs W. Europe</div>
            <div className={`font-mono font-bold ${comp.annualSavingsVsWEurope < 0 ? 'text-green-400' : 'text-red-400'}`}>
              {comp.annualSavingsVsWEurope < 0 ? '✅ ' : '⚠ '}
              {fmtNum(Math.abs(comp.annualSavingsVsWEurope), 0)} {cur}
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Ladder */}
      <div className="bg-slate-800/60 rounded-lg overflow-hidden">
        <SectionHeader title="Pricing Ladder" className="px-4 pt-4 mb-0 pb-3" />
        <table className="w-full">
          <thead>
            <tr className="bg-slate-900/50">
              <th className="text-left py-2 px-4 text-xs text-slate-400 font-medium">Price Point</th>
              <th className="text-right py-2 px-4 text-xs text-slate-400 font-medium">Price/Part</th>
              <th className="text-right py-2 px-4 text-xs text-slate-400 font-medium">Our Margin</th>
              <th className="text-right py-2 px-4 text-xs text-slate-400 font-medium">vs Walk-Away</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {ladderRows.map((r) => {
              const margin = cm.totalMfgCost > 0 ? (r.price - cm.totalMfgCost) / r.price : 0;
              const vsWalkAway = r.price - ps.walkAway.price;
              return (
                <tr key={r.name} className="hover:bg-slate-700/30">
                  <td className={`py-2 px-4 text-sm font-medium ${r.rowColor}`}>{r.name}</td>
                  <td className="py-2 px-4 text-right font-mono text-sm text-slate-200">{fmtPrice(r.price)} {cur}</td>
                  <td className={`py-2 px-4 text-right font-mono text-sm ${margin > 0.15 ? 'text-green-400' : margin > 0.05 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {fmtPct(margin)}
                  </td>
                  <td className={`py-2 px-4 text-right font-mono text-sm ${vsWalkAway >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {vsWalkAway >= 0 ? '+' : ''}{fmtPrice(vsWalkAway)} {cur}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Price comparison chart */}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="Price vs Cost Chart" />
        <PriceComparisonChart
          cost={cm}
          prices={ps}
          comp={comp}
          currency={cur}
          customerTarget={state.input.targetPrice}
        />
      </div>
    </div>
  );
}
