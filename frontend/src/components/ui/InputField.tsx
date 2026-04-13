import React from 'react';

interface InputFieldProps {
  label: string;
  value: string | number;
  onChange: (val: string) => void;
  type?: 'text' | 'number' | 'date';
  unit?: string;
  tooltip?: string;
  step?: string;
  min?: number;
  max?: number;
  className?: string;
}

export function InputField({
  label, value, onChange, type = 'text', unit, tooltip, step, min, max, className = '',
}: InputFieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
        {label}
        {tooltip && (
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-600 text-slate-300 text-xs cursor-help"
            title={tooltip}
          >
            ?
          </span>
        )}
        {unit && <span className="text-slate-500 font-normal">[{unit}]</span>}
      </label>
      <div className="flex items-center gap-1">
        <input
          type={type}
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
          className="
            w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm
            text-blue-300 font-mono
            focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
            placeholder-slate-500
          "
        />
      </div>
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  unit?: string;
  tooltip?: string;
  className?: string;
}

export function SelectField({ label, value, onChange, options, unit, tooltip, className = '' }: SelectFieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-xs font-medium text-slate-400 flex items-center gap-1">
        {label}
        {tooltip && (
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-600 text-slate-300 text-xs cursor-help"
            title={tooltip}
          >
            ?
          </span>
        )}
        {unit && <span className="text-slate-500 font-normal">[{unit}]</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm
          text-blue-300 font-mono
          focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
        "
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
