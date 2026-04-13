import React from 'react';
import { useRfq } from '../../context/RfqContext';
import { InputField } from '../ui/InputField';
import { SectionHeader } from '../ui/SectionHeader';
import { StatusBadge } from '../ui/StatusBadge';
import { fmtPrice, fmtPct, fmtNum } from '../../utils/formatters';

export function PriceStrategy() {
  const { state, computed, dispatch } = useRfq();
  const { priceStrategy: ps, costModel: cm } = computed;
  const cur = state.input.currency;
  const margins = state.priceMargins;

  function setMargin(payload: Partial<typeof margins>) {
    dispatch({ type: 'SET_MARGINS', payload });
  }

  const cols = [
    { key: 'walkAway', label: 'Walk-Away', data: ps.walkAway, color: 'text-red-400' },
    { key: 'target', label: 'Target', data: ps.target, color: 'text-green-400' },
    { key: 'aggressive', label: 'Aggressive', data: ps.aggressive, color: 'text-yellow-400' },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-100">Price Strategy</h1>
        <p className="text-xs text-slate-400">Margin inputs are editable — prices auto-calculate from cost model.</p>
      </div>

      {/* Margin inputs */}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="Margin Thresholds (editable)" />
        <div className="grid grid-cols-3 gap-4">
          <InputField
            label="Walk-Away Margin (min)"
            value={margins.marginMin}
            onChange={(v) => setMargin({ marginMin: parseFloat(v) || 0 })}
            type="number" step="0.01" min={0} max={1} unit="0–1"
            tooltip="Absolute minimum margin. Below = NO GO."
          />
          <InputField
            label="Target Margin"
            value={margins.marginTarget}
            onChange={(v) => setMargin({ marginTarget: parseFloat(v) || 0 })}
            type="number" step="0.01" min={0} max={1} unit="0–1"
          />
          <InputField
            label="Aggressive Margin"
            value={margins.marginAggressive}
            onChange={(v) => setMargin({ marginAggressive: parseFloat(v) || 0 })}
            type="number" step="0.01" min={0} max={1} unit="0–1"
            tooltip="Premium scenario — use for strong positions"
          />
        </div>
      </div>

      {/* Price comparison table */}
      <div className="bg-slate-800/60 rounded-lg overflow-hidden">
        <SectionHeader title="Price Comparison" className="px-4 pt-4 mb-0 pb-3" />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="text-left py-2 px-4 text-xs text-slate-400 font-medium w-48">Metric</th>
                {cols.map((c) => (
                  <th key={c.key} className={`text-right py-2 px-4 text-xs font-semibold ${c.color}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {[
                { label: 'Selling Price', fn: (d: typeof ps.target) => `${fmtPrice(d.price)} ${cur}`, big: true },
                { label: 'Gross Margin/Part', fn: (d: typeof ps.target) => `${fmtPrice(d.grossMarginPerPart)} ${cur}` },
                { label: 'Margin %', fn: (d: typeof ps.target) => fmtPct(d.margin) },
                { label: 'vs Customer Target', fn: (d: typeof ps.target) => `${d.vsCustomerTarget >= 0 ? '+' : ''}${fmtPrice(d.vsCustomerTarget)} ${cur}` },
                { label: 'Annual Revenue', fn: (d: typeof ps.target) => `${fmtNum(d.annualRevenue, 0)} ${cur}` },
                { label: 'Annual Profit', fn: (d: typeof ps.target) => `${fmtNum(d.annualProfit, 0)} ${cur}` },
                { label: 'Lifetime Revenue', fn: (d: typeof ps.target) => `${fmtNum(d.lifetimeRevenue, 0)} ${cur}` },
                { label: 'Break-Even Volume', fn: (d: typeof ps.target) => `${fmtNum(d.breakEvenVolume, 0)} pcs` },
                { label: 'Financing Cost/Part', fn: (d: typeof ps.target) => `${fmtPrice(d.financingCost)} ${cur}` },
              ].map((row) => (
                <tr key={row.label} className={`hover:bg-slate-700/30 ${row.big ? 'bg-slate-700/20' : ''}`}>
                  <td className="py-2 px-4 text-sm text-slate-300 font-medium">{row.label}</td>
                  {cols.map((c) => (
                    <td key={c.key} className={`py-2 px-4 text-right font-mono text-sm ${row.big ? c.color + ' font-bold text-base' : 'text-slate-200'}`}>
                      {row.fn(c.data)}
                    </td>
                  ))}
                </tr>
              ))}
              {/* Risk row */}
              <tr className="hover:bg-slate-700/30">
                <td className="py-2 px-4 text-sm text-slate-300 font-medium">Risk Assessment</td>
                {cols.map((c) => (
                  <td key={c.key} className="py-2 px-4 text-right">
                    <span className="text-xs font-mono text-slate-300">{c.data.risk}</span>
                  </td>
                ))}
              </tr>
              {/* GO/NO GO row */}
              <tr className="bg-slate-900/30">
                <td className="py-2 px-4 text-sm font-semibold text-slate-200">GO / NO GO</td>
                {cols.map((c) => (
                  <td key={c.key} className="py-2 px-4 text-right">
                    <StatusBadge text={c.data.goNoGo} size="sm" />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Reference row */}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="Reference" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="bg-slate-900/50 rounded p-3">
            <div className="text-xs text-slate-400 mb-1">Total Mfg Cost</div>
            <div className="font-mono font-bold text-slate-100">{fmtPrice(cm.totalMfgCost)} {cur}</div>
          </div>
          <div className="bg-slate-900/50 rounded p-3">
            <div className="text-xs text-slate-400 mb-1">Customer Target</div>
            <div className="font-mono font-bold text-purple-300">{fmtPrice(state.input.targetPrice)} {cur}</div>
          </div>
          <div className="bg-slate-900/50 rounded p-3">
            <div className="text-xs text-slate-400 mb-1">Payment Terms</div>
            <div className="font-mono font-bold text-slate-100">{state.input.paymentTerms} days</div>
          </div>
          <div className="bg-slate-900/50 rounded p-3">
            <div className="text-xs text-slate-400 mb-1">Mid Volume</div>
            <div className="font-mono font-bold text-slate-100">{fmtNum(state.input.volMid, 0)} pcs/yr</div>
          </div>
        </div>
      </div>
    </div>
  );
}
