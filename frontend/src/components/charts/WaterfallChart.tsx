import React from 'react';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer, LabelList,
} from 'recharts';
import type { CostModelResult } from '../../types/rfq';
import { fmtPrice } from '../../utils/formatters';

interface Props { cost: CostModelResult; packLog: number; currency: string; }

const COLORS: Record<string, string> = {
  Material: '#10b981',
  Machine:  '#3b82f6',
  Tooling:  '#8b5cf6',
  Labor:    '#f59e0b',
  Energy:   '#ef4444',
  Overhead: '#06b6d4',
  'Pack+Log': '#f97316',
  TOTAL:    '#1d4ed8',
};

export function WaterfallChart({ cost, packLog, currency }: Props) {
  const segments = [
    { name: 'Material', value: cost.material.totalMaterialCost },
    { name: 'Machine',  value: cost.machine.totalMachineCost },
    { name: 'Tooling',  value: cost.tooling.totalToolingCost },
    { name: 'Labor',    value: cost.labor.totalLaborCost },
    { name: 'Energy',   value: cost.energy.totalEnergyCost },
    { name: 'Overhead', value: cost.overhead.totalOverhead },
    { name: 'Pack+Log', value: packLog },
  ].filter(s => s.value > 0);

  let running = 0;
  const data = segments.map(s => {
    const ghost = running;
    running += s.value;
    return { name: s.name, ghost, value: s.value, total: running };
  });
  data.push({ name: 'TOTAL', ghost: 0, value: cost.totalMfgCost, total: cost.totalMfgCost });

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: typeof data[0] }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const isTotal = label === 'TOTAL';
    return (
      <div className="bg-slate-800 border border-slate-600 rounded p-2 text-xs shadow-xl">
        <div className="font-semibold text-slate-200 mb-1">{label}</div>
        <div className="text-blue-300 font-mono">{fmtPrice(d.value)} {currency}/part</div>
        {!isTotal && <div className="text-slate-400">Cum: {fmtPrice(d.total)} {currency}</div>}
        {!isTotal && <div className="text-slate-400">% of total: {cost.totalMfgCost > 0 ? (d.value / cost.totalMfgCost * 100).toFixed(1) : 0}%</div>}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => fmtPrice(v)}
          width={54}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
        {/* Ghost bar — invisible spacer */}
        <Bar dataKey="ghost" stackId="a" fill="transparent" />
        {/* Value bar */}
        <Bar dataKey="value" stackId="a" radius={[3, 3, 0, 0]}>
          <LabelList
            dataKey="value"
            position="top"
            formatter={(v: number) => fmtPrice(v)}
            style={{ fill: '#94a3b8', fontSize: 10 }}
          />
          {data.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name] ?? '#3b82f6'} />
          ))}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
