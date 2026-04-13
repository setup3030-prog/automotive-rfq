import React from 'react';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeader({ title, subtitle, className = '' }: SectionHeaderProps) {
  return (
    <div className={`border-b border-slate-700 pb-2 mb-4 ${className}`}>
      <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}
