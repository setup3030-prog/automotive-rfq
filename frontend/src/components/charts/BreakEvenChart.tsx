import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import type { CostModelResult, PriceStrategyResult, RfqInput } from '../../types/rfq';
import { fmtPrice, fmtNum } from '../../utils/formatters';

interface Props {
  cost: CostModelResult;
  prices: PriceStrategyResult;
  inp: RfqInput;
  currency: string;
}

export function BreakEvenChart({ cost, prices, inp, currency }: Props) {
  const fixedCost = inp.fixedOverhead;
  const varPerPart = cost.totalMfgCost - cost.overhead.fixedOhPerPart;

  const volMin = Math.max(1000, inp.volLow * 0.5);
  const volMax = inp.volPeak * 1.2;
  const steps = 10;
  const step = (volMax - volMin) / steps;

  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const v = Math.round(volMin + i * step);
    return {
      vol: v,
      cost:       Math.round(varPerPart * v + fixedCost),
      walkAway:   Math.round(prices.walkAway.price * v),
      target:     Math.round(prices.target.price * v),
      aggressive: Math.round(prices.aggressive.price * v),
    };
  });

  const bev = prices.target.breakEvenVolume;

  const fmt = (v: number) => v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v);

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: number;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-slate-800 border border-slate-600 rounded p-2 text-xs shadow-xl">
        <div className="font-semibold text-slate-300 mb-1">Vol: {fmtNum(label ?? 0, 0)} pcs</div>
        {payload.map(p => (
          <div key={p.name} style={{ color: p.color }} className="font-mono">
            {p.name}: {fmtNum(p.value, 0)} {currency}
          </div>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={points} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="vol"
          tick={{ fill: '#94a3b8', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={fmt}
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={fmt}
          width={54}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>}
        />
        {bev > 0 && (
          <ReferenceLine
            x={Math.round(bev / step) * step + volMin}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            label={{ value: `BEV ${fmt(bev)}`, fill: '#94a3b8', fontSize: 10, position: 'insideTopRight' }}
          />
        )}
        <ReferenceLine x={inp.volMid} stroke="#3b82f6" strokeDasharray="4 4"
          label={{ value: 'Mid Vol', fill: '#3b82f6', fontSize: 10, position: 'insideTopLeft' }} />
        <Line type="monotone" dataKey="cost"       name="Total Cost"  stroke="#ef4444" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="walkAway"   name="Walk-Away"   stroke="#f97316" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
        <Line type="monotone" dataKey="target"     name="Target"      stroke="#22c55e" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="aggressive" name="Aggressive"  stroke="#a78bfa" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
      </LineChart>
    </ResponsiveContainer>
  );
}
