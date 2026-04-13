import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { CostModelResult } from '../../types/rfq';
import { fmtPrice, fmtPct } from '../../utils/formatters';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];

interface Props {
  cost: CostModelResult;
  currency: string;
}

export function CostBreakdownChart({ cost, currency }: Props) {
  const total = cost.totalMfgCost;
  const data = [
    { name: 'Machine', value: cost.machine.totalMachineCost },
    { name: 'Material', value: cost.material.totalMaterialCost },
    { name: 'Tooling', value: cost.tooling.totalToolingCost },
    { name: 'Labor', value: cost.labor.totalLaborCost },
    { name: 'Energy', value: cost.energy.totalEnergyCost },
    { name: 'Overhead', value: cost.overhead.totalOverhead },
  ].filter((d) => d.value > 0);

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
    cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number;
  }) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
        {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) => {
    if (!active || !payload?.length) return null;
    const { name, value } = payload[0];
    return (
      <div className="bg-slate-800 border border-slate-600 rounded p-2 text-xs">
        <div className="font-semibold text-slate-200">{name}</div>
        <div className="text-blue-300 font-mono">{fmtPrice(value)} {currency}/part</div>
        <div className="text-slate-400">{fmtPct(value / total)} of total</div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={110}
          paddingAngle={2}
          dataKey="value"
          labelLine={false}
          label={renderCustomLabel}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => <span style={{ color: '#94a3b8', fontSize: 12 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
