import React from 'react';

interface StatusBadgeProps {
  text: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function getColor(text: string): string {
  const t = text.toUpperCase();
  if (t.includes('NO GO') || t.includes('LOSS') || t.includes('HIGH RISK') || t.includes('NOT COMPETITIVE')) {
    return 'bg-red-900/40 border-red-700 text-red-300';
  }
  if (t.includes('MARGINAL') || t.includes('MEDIUM') || t.includes('CAUTION') || t.includes('CHALLENGING')) {
    return 'bg-yellow-900/40 border-yellow-700 text-yellow-300';
  }
  if (t.includes('GO') || t.includes('STRONG') || t.includes('COMPETITIVE') || t.includes('LOW RISK')) {
    return 'bg-green-900/40 border-green-700 text-green-300';
  }
  return 'bg-slate-700/40 border-slate-600 text-slate-300';
}

const sizeMap = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-3 py-1',
  lg: 'text-base px-4 py-1.5 font-semibold',
};

export function StatusBadge({ text, size = 'md', className = '' }: StatusBadgeProps) {
  return (
    <span className={`inline-block border rounded font-mono whitespace-nowrap ${getColor(text)} ${sizeMap[size]} ${className}`}>
      {text}
    </span>
  );
}
