import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';
import type { SensitivityPoint } from '../../types/rfq';
import { fmtPrice } from '../../utils/formatters';

interface Props {
  points: SensitivityPoint[];
  xLabel: string;
  xFormatter?: (v: number) => string;
  customerTarget: number;
  currency: string;
}

export function SensitivityChart({ points, xLabel, xFormatter, customerTarget, currency }: Props) {
  const fmt = xFormatter ?? ((v: number) => String(v));

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string | number }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-slate-800 border border-slate-600 rounded p-2 text-xs">
        <div className="text-slate-400 mb-1">{xLabel}: <span className="text-slate-200 font-mono">{label !== undefined ? fmt(Number(label)) : '—'}</span></div>
        {payload.map((p, i) => (
          <div key={i} className="font-mono" style={{ color: p.name === 'Cost/Part' ? '#3b82f6' : '#8b5cf6' }}>
            {p.name}: {fmtPrice(p.value)} {currency}
          </div>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={points} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="param"
          tickFormatter={fmt}
          tick={{ fill: '#94a3b8', fontSize: 10 }}
          label={{ value: xLabel, position: 'insideBottom', offset: -2, fill: '#94a3b8', fontSize: 11 }}
          height={40}
        />
        <YAxis
          tickFormatter={(v) => fmtPrice(v, 2)}
          tick={{ fill: '#94a3b8', fontSize: 10 }}
          width={55}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <ReferenceLine
          y={customerTarget}
          stroke="#8b5cf6"
          strokeDasharray="5 5"
          label={{ value: 'Customer Target', fill: '#8b5cf6', fontSize: 10, position: 'right' }}
        />
        <Line
          type="monotone"
          dataKey="cost"
          name="Cost/Part"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={(props) => {
            const { cx, cy, payload } = props as { cx: number; cy: number; payload: SensitivityPoint };
            if (payload.isBase) {
              return <circle key={`dot-base-${cx}`} cx={cx} cy={cy} r={6} fill="#f59e0b" stroke="#1e293b" strokeWidth={2} />;
            }
            return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={3} fill="#3b82f6" />;
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
