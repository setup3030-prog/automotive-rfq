import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import type { CostModelResult, PriceStrategyResult, CompetitivenessResult } from '../../types/rfq';
import { fmtPrice } from '../../utils/formatters';

interface Props {
  cost: CostModelResult;
  prices: PriceStrategyResult;
  comp: CompetitivenessResult;
  currency: string;
  customerTarget: number;
}

export function PriceComparisonChart({ cost, prices, comp, currency, customerTarget }: Props) {
  const data = [
    { name: 'Mfg Cost', value: cost.totalMfgCost, color: '#64748b' },
    { name: 'Walk-Away', value: prices.walkAway.price, color: '#ef4444' },
    { name: 'Target', value: prices.target.price, color: '#10b981' },
    { name: 'Aggressive', value: prices.aggressive.price, color: '#f59e0b' },
    { name: 'Customer\nTarget', value: customerTarget, color: '#8b5cf6' },
    { name: 'Comp. Mid', value: comp.competitorMid, color: '#06b6d4' },
  ];

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-slate-800 border border-slate-600 rounded p-2 text-xs">
        <div className="font-semibold text-slate-200">{label}</div>
        <div className="text-blue-300 font-mono">{fmtPrice(payload[0].value)} {currency}</div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
        <YAxis tickFormatter={(v) => fmtPrice(v, 2)} tick={{ fill: '#94a3b8', fontSize: 10 }} width={55} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={cost.totalMfgCost} stroke="#64748b" strokeDasharray="4 4" label={{ value: 'Cost', fill: '#94a3b8', fontSize: 10 }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
          <LabelList
            dataKey="value"
            position="top"
            formatter={(v: number) => fmtPrice(v, 2)}
            style={{ fill: '#e2e8f0', fontSize: 10, fontFamily: 'monospace' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
