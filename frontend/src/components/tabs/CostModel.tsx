import React from 'react';
import { useRfq } from '../../context/RfqContext';
import { SectionHeader } from '../ui/SectionHeader';
import { fmtPrice, fmtPct, fmtNum, fmtVol } from '../../utils/formatters';
import { CostBreakdownChart } from '../charts/CostBreakdownChart';

interface RowProps { label: string; value: number; pct: number; annual: number; currency: string; highlight?: boolean }
function CostRow({ label, value, pct, annual, currency, highlight }: RowProps) {
  return (
    <tr className={highlight ? 'bg-blue-900/20 font-semibold' : 'hover:bg-slate-700/30'}>
      <td className="py-1.5 px-3 text-slate-300 text-sm">{label}</td>
      <td className="py-1.5 px-3 text-right font-mono text-blue-300 text-sm">{fmtPrice(value)} {currency}</td>
      <td className="py-1.5 px-3 text-right font-mono text-slate-400 text-sm">{fmtPct(pct)}</td>
      <td className="py-1.5 px-3 text-right font-mono text-slate-300 text-sm">{fmtNum(annual, 0)} {currency}</td>
    </tr>
  );
}

export function CostModel() {
  const { computed, state } = useRfq();
  const { costModel: c } = computed;
  const cur = state.input.currency;
  const vol = state.input.volMid;
  const total = c.totalMfgCost;
  const pct = (v: number) => total > 0 ? v / total : 0;

  const rows = [
    { label: 'Machine & Process', value: c.machine.totalMachineCost, id: 'machine' },
    { label: 'Material', value: c.material.totalMaterialCost, id: 'material' },
    { label: 'Tooling', value: c.tooling.totalToolingCost, id: 'tooling' },
    { label: 'Direct Labor', value: c.labor.directLaborPerPart, id: 'labor-d' },
    { label: 'Indirect Labor', value: c.labor.indirectLaborPerPart, id: 'labor-i' },
    { label: 'Energy', value: c.energy.totalEnergyCost, id: 'energy' },
    { label: 'Fixed Overhead', value: c.overhead.fixedOhPerPart, id: 'oh-f' },
    { label: 'Variable Overhead', value: c.overhead.variableOhPerPart, id: 'oh-v' },
    { label: 'Packaging', value: state.input.packagingCost, id: 'pack' },
    { label: 'Logistics', value: state.input.logisticsCost, id: 'log' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-100">Cost Model</h1>
        <p className="text-xs text-slate-400">Auto-calculated from RFQ Input. Read-only.</p>
      </div>

      {/* Guards */}
      {c.guards.oeeWarning && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded px-3 py-2 text-xs text-yellow-300">
          ⚠ OEE CAPPED — input was {fmtPct(state.input.oee)}, using 90%
        </div>
      )}
      {c.guards.scrapWarning && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded px-3 py-2 text-xs text-yellow-300">
          ⚠ SCRAP FLOORED — input was {fmtPct(state.input.scrapRate)}, using 2%
        </div>
      )}

      {/* Machine stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Parts/Hour (Gross)', value: fmtNum(c.machine.partsPerHourGross, 1) },
          { label: 'Parts/Hour (Net)', value: fmtNum(c.machine.partsPerHourNet, 1) },
          { label: 'Required Hours/yr', value: fmtNum(c.machine.requiredHoursYear, 0) },
          { label: 'Machine Utilization', value: fmtPct(c.machine.machineUtilization) },
        ].map((k) => (
          <div key={k.label} className="bg-slate-800/60 rounded p-3">
            <div className="text-xs text-slate-400 mb-1">{k.label}</div>
            <div className="font-mono text-slate-100 font-semibold">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost breakdown table */}
        <div className="bg-slate-800/60 rounded-lg overflow-hidden">
          <SectionHeader title="Cost Summary (per part)" className="px-4 pt-4 mb-0 pb-3" />
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">Category</th>
                <th className="text-right py-2 px-3 text-xs text-slate-400 font-medium">Cost/Part</th>
                <th className="text-right py-2 px-3 text-xs text-slate-400 font-medium">% Total</th>
                <th className="text-right py-2 px-3 text-xs text-slate-400 font-medium">Annual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {rows.map((r) => (
                <CostRow key={r.id} label={r.label} value={r.value} pct={pct(r.value)} annual={r.value * vol} currency={cur} />
              ))}
              <CostRow label="TOTAL MFG COST" value={total} pct={1} annual={total * vol} currency={cur} highlight />
            </tbody>
          </table>
        </div>

        {/* Donut chart */}
        <div className="bg-slate-800/60 rounded-lg p-4">
          <SectionHeader title="Cost Breakdown" />
          <CostBreakdownChart cost={c} currency={cur} />
        </div>
      </div>

      {/* Detail sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Machine detail */}
        <div className="bg-slate-800/60 rounded-lg p-4">
          <SectionHeader title="Machine Detail" />
          <table className="w-full text-xs">
            <tbody className="space-y-1">
              {[
                ['Machine Cost/Part', fmtPrice(c.machine.machineCostPerPart)],
                ['Setup Cost/Part', fmtPrice(c.machine.setupCostPerPart)],
                ['Maint Cost/Part', fmtPrice(c.machine.maintenancePerPart)],
                ['OEE Used', fmtPct(c.guards.oeeUsed)],
                ['Scrap Used', fmtPct(c.guards.scrapUsed)],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-slate-700/30">
                  <td className="py-1 text-slate-400">{k}</td>
                  <td className="py-1 text-right font-mono text-slate-200">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Material detail */}
        <div className="bg-slate-800/60 rounded-lg p-4">
          <SectionHeader title="Material Detail" />
          <table className="w-full text-xs">
            <tbody>
              {[
                ['Net Part Weight', fmtPrice(c.material.netPartWeight, 4) + ' kg'],
                ['Runner/Part', fmtPrice(c.material.runnerPerPart, 4) + ' kg'],
                ['Gross Weight', fmtPrice(c.material.grossWeight, 4) + ' kg'],
                ['Eff. Mat Price', fmtPrice(c.material.effectiveMatPrice, 2) + ' ' + cur + '/kg'],
                ['Gross Mat Cost', fmtPrice(c.material.grossMaterialCost)],
                ['Regrind Credit', fmtPrice(c.material.regrindCredit)],
                ['Scrap Cost', fmtPrice(c.material.scrapCost)],
                ['Material Waste', fmtPrice(c.material.materialWaste)],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-slate-700/30">
                  <td className="py-1 text-slate-400">{k}</td>
                  <td className="py-1 text-right font-mono text-slate-200">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tooling detail */}
        <div className="bg-slate-800/60 rounded-lg p-4">
          <SectionHeader title="Tooling Detail" />
          <table className="w-full text-xs">
            <tbody>
              {[
                ['Annual Shots', fmtVol(c.tooling.annualShots)],
                ['Tool Life (yrs)', fmtNum(c.tooling.toolLifeYears, 1)],
                ['Amortization/Part', fmtPrice(c.tooling.amortizationPerPart)],
                ['Maintenance/Part', fmtPrice(c.tooling.maintenancePerPartTool)],
                ['Financing/Part', fmtPrice(c.tooling.financingCostPerPart)],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-slate-700/30">
                  <td className="py-1 text-slate-400">{k}</td>
                  <td className="py-1 text-right font-mono text-slate-200">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
