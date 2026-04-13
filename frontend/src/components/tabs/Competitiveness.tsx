import React from 'react';
import { useRfq } from '../../context/RfqContext';
import { InputField } from '../ui/InputField';
import { SectionHeader } from '../ui/SectionHeader';
import { StatusBadge } from '../ui/StatusBadge';
import { fmtPrice, fmtPct, fmtNum } from '../../utils/formatters';
import { PriceComparisonChart } from '../charts/PriceComparisonChart';

export function Competitiveness() {
  const { state, computed, dispatch } = useRfq();
  const { competitiveness: comp, priceStrategy: ps, costModel: cm } = computed;
  const ci = state.competitiveness;
  const cur = state.input.currency;

  function setComp(payload: Partial<typeof ci>) {
    dispatch({ type: 'SET_COMPETITIVENESS', payload });
  }

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
