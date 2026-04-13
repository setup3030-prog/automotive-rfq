import React from 'react';
import { useRfq } from '../../context/RfqContext';
import { SectionHeader } from '../ui/SectionHeader';
import { fmtPrice, fmtPct } from '../../utils/formatters';
import { SensitivityChart } from '../charts/SensitivityChart';
import type { SensitivityPoint } from '../../types/rfq';

function SensTable({ points, paramLabel, paramFmt }: { points: SensitivityPoint[]; paramLabel: string; paramFmt: (v: number) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-900/50">
            {[paramLabel, 'Cost/Part', 'vs Base', 'Margin@Target', 'GO/NO GO'].map((h) => (
              <th key={h} className="py-1.5 px-2 text-slate-400 font-medium text-center whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/30">
          {points.map((p, i) => (
            <tr key={i} className={p.isBase ? 'bg-yellow-900/30 font-semibold' : 'hover:bg-slate-700/20'}>
              <td className={`py-1.5 px-2 text-center font-mono ${p.isBase ? 'text-yellow-300' : 'text-slate-300'}`}>
                {paramFmt(p.param)}{p.isBase ? ' ★' : ''}
              </td>
              <td className="py-1.5 px-2 text-center font-mono text-blue-300">{fmtPrice(p.cost)}</td>
              <td className={`py-1.5 px-2 text-center font-mono ${p.vsBase > 0 ? 'text-red-400' : p.vsBase < 0 ? 'text-green-400' : 'text-slate-400'}`}>
                {p.vsBase === 0 ? '—' : (p.vsBase > 0 ? '+' : '') + fmtPrice(p.vsBase)}
              </td>
              <td className={`py-1.5 px-2 text-center font-mono ${p.marginAtTarget > 0.12 ? 'text-green-400' : p.marginAtTarget > 0.06 ? 'text-yellow-400' : 'text-red-400'}`}>
                {fmtPct(p.marginAtTarget)}
              </td>
              <td className="py-1.5 px-2 text-center text-xs">{p.goNoGo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Sensitivity() {
  const { computed, state } = useRfq();
  const { sensitivity: sens } = computed;
  const cur = state.input.currency;
  const cTarget = state.input.targetPrice;

  const analyses = [
    {
      title: 'Cycle Time Sensitivity',
      subtitle: 'Impact of cycle time variation on cost and margin',
      points: sens.cycleTime,
      xLabel: 'Cycle Time (s)',
      fmt: (v: number) => `${v}s`,
    },
    {
      title: 'Material Price Sensitivity',
      subtitle: 'Impact of material price % change on cost and margin',
      points: sens.materialPrice,
      xLabel: '% of Base Price',
      fmt: (v: number) => `${(v * 100).toFixed(0)}%`,
    },
    {
      title: 'OEE Sensitivity',
      subtitle: 'Impact of OEE variation on cost and margin',
      points: sens.oee,
      xLabel: 'OEE',
      fmt: (v: number) => `${(v * 100).toFixed(0)}%`,
    },
    {
      title: 'Energy Price Sensitivity',
      subtitle: `Impact of energy price variation on cost (base: ${fmtPrice(state.input.energyPrice, 2)} ${cur}/kWh)`,
      points: sens.energyPrice,
      xLabel: `Energy Price (${cur}/kWh)`,
      fmt: (v: number) => fmtPrice(v, 2),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-100">Sensitivity Analysis</h1>
        <p className="text-xs text-slate-400">
          Auto-calculated. Yellow star (★) = base case. Reference line = customer target ({fmtPrice(cTarget)} {cur}).
        </p>
      </div>

      {analyses.map((a) => (
        <div key={a.title} className="bg-slate-800/60 rounded-lg p-4 space-y-4">
          <SectionHeader title={a.title} subtitle={a.subtitle} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SensTable points={a.points} paramLabel={a.xLabel} paramFmt={a.fmt} />
            <SensitivityChart
              points={a.points}
              xLabel={a.xLabel}
              xFormatter={a.fmt}
              customerTarget={cTarget}
              currency={cur}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
