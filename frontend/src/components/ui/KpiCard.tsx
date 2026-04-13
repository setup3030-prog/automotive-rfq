import React from 'react';

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: 'green' | 'yellow' | 'red' | 'blue' | 'none';
  className?: string;
}

const highlightMap = {
  green: 'border-green-700 bg-green-900/20',
  yellow: 'border-yellow-700 bg-yellow-900/20',
  red: 'border-red-700 bg-red-900/20',
  blue: 'border-blue-700 bg-blue-900/20',
  none: 'border-slate-700 bg-slate-800/50',
};

const valueColorMap = {
  green: 'text-green-400',
  yellow: 'text-yellow-400',
  red: 'text-red-400',
  blue: 'text-blue-400',
  none: 'text-slate-100',
};

export function KpiCard({ label, value, sub, highlight = 'none', className = '' }: KpiCardProps) {
  return (
    <div className={`rounded-lg border p-3 flex flex-col gap-1 ${highlightMap[highlight]} ${className}`}>
      <div className="text-xs text-slate-400 uppercase tracking-wide font-medium">{label}</div>
      <div className={`text-lg font-mono font-bold ${valueColorMap[highlight]}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
