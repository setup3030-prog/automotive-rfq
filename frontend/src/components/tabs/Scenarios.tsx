import React from 'react';
import { useRfq } from '../../context/RfqContext';
import { InputField } from '../ui/InputField';
import { SectionHeader } from '../ui/SectionHeader';
import { StatusBadge } from '../ui/StatusBadge';
import { fmtPrice, fmtPct, fmtNum } from '../../utils/formatters';
import type { ScenarioParams } from '../../types/rfq';

type ScenarioKey = 'best' | 'realistic' | 'worst';

const SCENARIO_DEFS: { key: ScenarioKey; label: string; color: string; textColor: string }[] = [
  { key: 'best', label: 'Best Case', color: 'border-green-700 bg-green-900/10', textColor: 'text-green-400' },
  { key: 'realistic', label: 'Realistic', color: 'border-blue-700 bg-blue-900/10', textColor: 'text-blue-400' },
  { key: 'worst', label: 'Worst Case', color: 'border-red-700 bg-red-900/10', textColor: 'text-red-400' },
];

const PARAM_ROWS: { key: keyof ScenarioParams; label: string; unit: string; step: string; isInt?: boolean }[] = [
  { key: 'volume', label: 'Annual Volume', unit: 'pcs/yr', step: '1000', isInt: true },
  { key: 'cycleTime', label: 'Cycle Time', unit: 's', step: '0.5' },
  { key: 'oee', label: 'OEE', unit: '0–1', step: '0.01' },
  { key: 'scrapRate', label: 'Scrap Rate', unit: '0–1', step: '0.005' },
  { key: 'materialPrice', label: 'Material Price', unit: 'curr/kg', step: '0.1' },
  { key: 'machineRate', label: 'Machine Rate', unit: 'curr/h', step: '1' },
  { key: 'laborRate', label: 'Labor Rate', unit: 'curr/h', step: '0.5' },
  { key: 'energyPrice', label: 'Energy Price', unit: 'curr/kWh', step: '0.01' },
  { key: 'fixedOverhead', label: 'Fixed Overhead/yr', unit: 'curr', step: '1000', isInt: true },
];

export function Scenarios() {
  const { state, computed, dispatch } = useRfq();
  const results = computed.scenarios;
  const cur = state.input.currency;

  function setScenario(scenario: ScenarioKey, data: Partial<ScenarioParams>) {
    dispatch({ type: 'SET_SCENARIO', payload: { scenario, data } });
  }

  function parseVal(v: string, isInt?: boolean): number {
    return isInt ? parseInt(v, 10) || 0 : parseFloat(v) || 0;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-100">Scenarios</h1>
        <p className="text-xs text-slate-400">All scenario parameters are editable. Results auto-calculate at 18% fixed margin.</p>
      </div>

      {/* Scenario result cards */}
      <div className="grid grid-cols-3 gap-4">
        {SCENARIO_DEFS.map((sd) => {
          const r = results.find((res) => res.name === sd.label);
          if (!r) return null;
          return (
            <div key={sd.key} className={`rounded-lg border p-4 space-y-3 ${sd.color}`}>
              <div className={`text-sm font-bold ${sd.textColor}`}>{sd.label}</div>
              <div>
                <div className="text-xs text-slate-400">Mfg Cost/Part</div>
                <div className="font-mono font-bold text-slate-100">{fmtPrice(r.mfgCost)} {cur}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Selling Price (18% margin)</div>
                <div className={`font-mono font-bold text-lg ${sd.textColor}`}>{fmtPrice(r.sellingPrice)} {cur}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-slate-400">Margin %</div>
                  <div className="font-mono text-slate-200">{fmtPct(r.margin)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Annual Profit</div>
                  <div className="font-mono text-slate-200">{fmtNum(r.annualProfit, 0)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Annual Revenue</div>
                  <div className="font-mono text-slate-200">{fmtNum(r.annualRevenue, 0)}</div>
                </div>
                <div>
                  <div className="text-slate-400">Decision</div>
                  <StatusBadge text={r.goNoGo} size="sm" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Editable parameters table */}
      <div className="bg-slate-800/60 rounded-lg overflow-hidden">
        <SectionHeader title="Scenario Parameters (editable)" className="px-4 pt-4 mb-0 pb-3" />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="text-left py-2 px-4 text-xs text-slate-400 font-medium w-40">Parameter</th>
                {SCENARIO_DEFS.map((sd) => (
                  <th key={sd.key} className={`text-center py-2 px-4 text-xs font-semibold ${sd.textColor}`}>
                    {sd.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {PARAM_ROWS.map((row) => (
                <tr key={row.key} className="hover:bg-slate-700/30">
                  <td className="py-2 px-4 text-xs text-slate-400">{row.label} <span className="text-slate-600">[{row.unit}]</span></td>
                  {SCENARIO_DEFS.map((sd) => (
                    <td key={sd.key} className="py-1.5 px-3">
                      <input
                        type="number"
                        step={row.step}
                        value={state.scenarios[sd.key][row.key]}
                        onChange={(e) => setScenario(sd.key, { [row.key]: parseVal(e.target.value, row.isInt) } as Partial<ScenarioParams>)}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm font-mono text-blue-300 focus:outline-none focus:border-blue-500 text-center"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results detail table */}
      <div className="bg-slate-800/60 rounded-lg overflow-hidden">
        <SectionHeader title="Calculated Results" className="px-4 pt-4 mb-0 pb-3" />
        <table className="w-full">
          <thead>
            <tr className="bg-slate-900/50">
              <th className="text-left py-2 px-4 text-xs text-slate-400 font-medium w-40">Metric</th>
              {SCENARIO_DEFS.map((sd) => (
                <th key={sd.key} className={`text-right py-2 px-4 text-xs font-semibold ${sd.textColor}`}>{sd.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {[
              { label: 'Mfg Cost/Part', fn: (r: typeof results[0]) => `${fmtPrice(r.mfgCost)} ${cur}` },
              { label: 'Selling Price', fn: (r: typeof results[0]) => `${fmtPrice(r.sellingPrice)} ${cur}` },
              { label: 'Margin %', fn: (r: typeof results[0]) => fmtPct(r.margin) },
              { label: 'Annual Revenue', fn: (r: typeof results[0]) => `${fmtNum(r.annualRevenue, 0)} ${cur}` },
              { label: 'Annual Profit', fn: (r: typeof results[0]) => `${fmtNum(r.annualProfit, 0)} ${cur}` },
              { label: 'GO / NO GO', fn: (r: typeof results[0]) => r.goNoGo },
            ].map((row) => (
              <tr key={row.label} className="hover:bg-slate-700/30">
                <td className="py-2 px-4 text-sm text-slate-300 font-medium">{row.label}</td>
                {results.map((r) => (
                  <td key={r.name} className="py-2 px-4 text-right font-mono text-sm text-slate-200">
                    {row.label === 'GO / NO GO'
                      ? <StatusBadge text={r.goNoGo} size="sm" />
                      : row.fn(r)
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
