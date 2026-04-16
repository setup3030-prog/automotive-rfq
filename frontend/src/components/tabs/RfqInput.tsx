import React, { useRef, useState } from 'react';
import { useRfq } from '../../context/RfqContext';
import { InputField, SelectField } from '../ui/InputField';
import { SectionHeader } from '../ui/SectionHeader';
import { LogisticsCalculator } from '../ui/LogisticsCalculator';
import { MachineCalculator } from '../ui/MachineCalculator';
import { EnergyLaborCalculator } from '../ui/EnergyLaborCalculator';
import { OverheadCalculator } from '../ui/OverheadCalculator';
import { exportJson, importJson } from '../../utils/storage';

function n(v: string): number { return parseFloat(v) || 0; }
function ni(v: string): number { return parseInt(v, 10) || 0; }

export function RfqInput() {
  const { state, dispatch } = useRfq();
  const inp = state.input;
  const [showLogCalc, setShowLogCalc] = useState(false);
  const [showMachCalc, setShowMachCalc] = useState(false);
  const [showEnergyCalc, setShowEnergyCalc] = useState(false);
  const [showOverheadCalc, setShowOverheadCalc] = useState(false);
  const guards = (() => {
    const oeeWarn = inp.oee > 0.90;
    const scrapWarn = inp.scrapRate < 0.02;
    const cycleWarn = inp.cycleTimeActual > 0 && inp.cycleTimeOptimized / inp.cycleTimeActual < 0.75;
    return { oeeWarn, scrapWarn, cycleWarn };
  })();

  const fileRef = useRef<HTMLInputElement>(null);

  function set(payload: Partial<typeof inp>) {
    dispatch({ type: 'SET_INPUT', payload });
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importJson(file);
      dispatch({ type: 'LOAD_STATE', payload: data });
    } catch {
      alert('Invalid JSON file.');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-100">RFQ Input</h1>
          <p className="text-xs text-slate-400">All fields editable — changes recalculate instantly</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportJson(state)}
            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded font-medium transition-colors"
          >
            Export JSON
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded font-medium transition-colors"
          >
            Import JSON
          </button>
          <button
            onClick={() => dispatch({ type: 'RESET' })}
            className="px-3 py-1.5 bg-slate-800 hover:bg-red-900/50 border border-slate-600 text-slate-300 text-xs rounded font-medium transition-colors"
          >
            Reset Defaults
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>
      </div>

      {/* Reality Guard Warnings */}
      {(guards.oeeWarn || guards.scrapWarn || guards.cycleWarn) && (
        <div className="space-y-1">
          {guards.oeeWarn && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded px-3 py-2 text-xs text-yellow-300">
              ⚠ OEE CAPPED — your input exceeds 90%. Model uses 90%.
            </div>
          )}
          {guards.scrapWarn && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded px-3 py-2 text-xs text-yellow-300">
              ⚠ SCRAP FLOORED — 2% is minimum realistic. Model uses 2%.
            </div>
          )}
          {guards.cycleWarn && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded px-3 py-2 text-xs text-yellow-300">
              ⚠ OPTIMIZED CYCLE &gt;25% BETTER THAN ACTUAL — VERIFY
            </div>
          )}
        </div>
      )}

      {/* 2.1 Currency */}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="2.1 Currency & Exchange Rate" />
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Currency"
            value={inp.currency}
            onChange={(v) => set({ currency: v as typeof inp.currency })}
            options={[{ value: 'PLN', label: 'PLN' }, { value: 'EUR', label: 'EUR' }, { value: 'USD', label: 'USD' }]}
          />
          <InputField
            label="EUR/PLN Rate"
            value={inp.eurPlnRate}
            onChange={(v) => set({ eurPlnRate: n(v) })}
            type="number" step="0.01" unit="EUR/PLN"
            tooltip="Exchange rate used for EUR conversions"
          />
        </div>
      </div>

      {/* 2.2 Client & Project */}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="2.2 Client & Project" />
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Customer Name" value={inp.customerName} onChange={(v) => set({ customerName: v })} />
          <InputField label="Project Name" value={inp.projectName} onChange={(v) => set({ projectName: v })} />
          <InputField label="Part Number" value={inp.partNumber} onChange={(v) => set({ partNumber: v })} />
          <InputField label="Part Description" value={inp.partDescription} onChange={(v) => set({ partDescription: v })} />
          <InputField label="Material Grade" value={inp.materialGrade} onChange={(v) => set({ materialGrade: v })} />
          <InputField label="RFQ Date" value={inp.rfqDate} onChange={(v) => set({ rfqDate: v })} type="date" />
          <InputField label="Quote Deadline" value={inp.quoteDeadline} onChange={(v) => set({ quoteDeadline: v })} type="date" />
          <InputField label="Quoting Engineer" value={inp.quotingEngineer} onChange={(v) => set({ quotingEngineer: v })} />
        </div>
      </div>

      {/* 2.3 Volume & Commercial */}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="2.3 Volume & Commercial Terms" />
        <div className="grid grid-cols-3 gap-4">
          <InputField label="Volume Low" value={inp.volLow} onChange={(v) => set({ volLow: ni(v) })} type="number" unit="pcs/yr" tooltip="Low annual volume scenario" />
          <InputField label="Volume Mid" value={inp.volMid} onChange={(v) => set({ volMid: ni(v) })} type="number" unit="pcs/yr" tooltip="Base volume used for cost model" />
          <InputField label="Volume Peak" value={inp.volPeak} onChange={(v) => set({ volPeak: ni(v) })} type="number" unit="pcs/yr" />
          <InputField label="Lifetime Volume" value={inp.volLifetime} onChange={(v) => set({ volLifetime: ni(v) })} type="number" unit="pcs total" />
          <InputField label="Contract Duration" value={inp.contractDuration} onChange={(v) => set({ contractDuration: ni(v) })} type="number" unit="years" />
          <InputField label="SOP" value={inp.sop} onChange={(v) => set({ sop: v })} tooltip="Start of Production" />
          <InputField label="Customer Target Price" value={inp.targetPrice} onChange={(v) => set({ targetPrice: n(v) })} type="number" step="0.0001" unit="curr/pc" tooltip="Customer's requested price" />
          <InputField label="Payment Terms" value={inp.paymentTerms} onChange={(v) => set({ paymentTerms: ni(v) })} type="number" unit="days" tooltip="Days to payment — affects financing cost" />
        </div>
      </div>

      {/* 2.4 Logistics */}
      {showLogCalc && <LogisticsCalculator onClose={() => setShowLogCalc(false)} />}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-4">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">2.4 Logistics & Packaging</h2>
          <button
            onClick={() => setShowLogCalc(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors"
          >
            <span>⚡</span> Calculate
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <SelectField
            label="Incoterms"
            value={inp.incoterms}
            onChange={(v) => set({ incoterms: v as typeof inp.incoterms })}
            options={[{ value: 'EXW', label: 'EXW' }, { value: 'FCA', label: 'FCA' }, { value: 'DAP', label: 'DAP' }, { value: 'DDP', label: 'DDP' }]}
          />
          <InputField label="Delivery Country" value={inp.deliveryCountry} onChange={(v) => set({ deliveryCountry: v })} />
          <InputField label="Packaging Type" value={inp.packagingType} onChange={(v) => set({ packagingType: v })} />
          <InputField label="Parts per Box" value={inp.partsPerBox} onChange={(v) => set({ partsPerBox: ni(v) })} type="number" unit="pcs" />
          <InputField label="Packaging Cost" value={inp.packagingCost} onChange={(v) => set({ packagingCost: n(v) })} type="number" step="0.0001" unit="curr/pc" />
          <InputField label="Logistics Cost" value={inp.logisticsCost} onChange={(v) => set({ logisticsCost: n(v) })} type="number" step="0.0001" unit="curr/pc" />
          <InputField label="Customs Duty" value={inp.customsDuty} onChange={(v) => set({ customsDuty: n(v) })} type="number" step="0.01" unit="%" />
        </div>
      </div>

      {/* 2.5 Machine & Process */}
      {showMachCalc && <MachineCalculator onClose={() => setShowMachCalc(false)} />}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-4">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">2.5 Machine & Process</h2>
          <button
            onClick={() => setShowMachCalc(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors"
          >
            <span>⚡</span> Calculate
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <InputField
            label="Cycle Time (Actual)"
            value={inp.cycleTimeActual}
            onChange={(v) => set({ cycleTimeActual: n(v) })}
            type="number" step="0.5" unit="s"
            tooltip="Always enter the ACTUAL cycle time — not optimistic"
            error={inp.cycleTimeActual <= 0 ? 'Wymagane > 0' : undefined}
            warn={inp.cycleTimeActual > 0 && inp.cycleTimeActual < 5 ? 'Bardzo krótki' : undefined}
          />
          <InputField
            label="Cycle Time (Optimized)"
            value={inp.cycleTimeOptimized}
            onChange={(v) => set({ cycleTimeOptimized: n(v) })}
            type="number" step="0.5" unit="s"
            tooltip="Potential optimized cycle — warning if >25% better than actual"
            warn={inp.cycleTimeActual > 0 && inp.cycleTimeOptimized / inp.cycleTimeActual < 0.75 ? '>25% lepszy' : undefined}
          />
          <InputField label="Cavities" value={inp.cavities} onChange={(v) => set({ cavities: ni(v) })} type="number" unit="cavities" tooltip="Number of mould cavities"
            error={inp.cavities <= 0 ? 'Min 1' : undefined}
          />
          <InputField label="Machine Size" value={inp.machineSize} onChange={(v) => set({ machineSize: ni(v) })} type="number" unit="kN" tooltip="Clamping force in kilonewtons"
            warn={inp.machineSize <= 0 ? 'Brak wartości' : undefined}
          />
          <InputField label="Machine Hourly Rate" value={inp.machineHourlyRate} onChange={(v) => set({ machineHourlyRate: n(v) })} type="number" step="0.5" unit="curr/h"
            error={inp.machineHourlyRate <= 0 ? 'Wymagane > 0' : undefined}
            warn={inp.machineHourlyRate > 0 && inp.machineHourlyRate < 50 ? 'Podejrzanie niska' : inp.machineHourlyRate > 1000 ? 'Podejrzanie wysoka' : undefined}
          />
          <InputField
            label="OEE"
            value={inp.oee}
            onChange={(v) => set({ oee: n(v) })}
            type="number" step="0.01" min={0} max={1} unit="0–1"
            tooltip="Overall Equipment Effectiveness. Max 0.90 enforced in model."
            error={inp.oee <= 0 ? 'Min > 0' : inp.oee > 1 ? 'Max 1.0' : undefined}
            warn={inp.oee > 0.90 ? 'Obcięte do 0.90' : inp.oee < 0.50 ? 'Bardzo niska' : undefined}
          />
          <InputField
            label="Scrap Rate"
            value={inp.scrapRate}
            onChange={(v) => set({ scrapRate: n(v) })}
            type="number" step="0.001" min={0} max={1} unit="0–1"
            tooltip="Min 0.02 (2%) enforced in model."
            warn={inp.scrapRate < 0.02 ? 'Podłoga 2%' : inp.scrapRate > 0.10 ? 'Bardzo wysoki' : undefined}
          />
          <InputField label="Working Hours/Year" value={inp.workingHoursYear} onChange={(v) => set({ workingHoursYear: ni(v) })} type="number" unit="h/yr"
            warn={inp.workingHoursYear > 8760 ? 'Max 8760 h/rok' : inp.workingHoursYear < 1000 ? 'Mało godzin' : undefined}
          />
        </div>
      </div>

      {/* 2.6 Material */}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="2.6 Material" />
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Shot Weight" value={inp.shotWeight} onChange={(v) => set({ shotWeight: n(v) })} type="number" step="0.001" unit="kg/shot" tooltip="Total shot weight (all cavities)" />
          <InputField label="Runner Weight" value={inp.runnerWeight} onChange={(v) => set({ runnerWeight: n(v) })} type="number" step="0.001" unit="kg/shot" />
          <InputField label="Material Price" value={inp.materialPrice} onChange={(v) => set({ materialPrice: n(v) })} type="number" step="0.1" unit="curr/kg" />
          <InputField
            label="Virgin/Regrind Ratio"
            value={inp.virginRegrindRatio}
            onChange={(v) => set({ virginRegrindRatio: n(v) })}
            type="number" step="0.05" min={0} max={1} unit="0–1"
            tooltip="1.0 = 100% virgin material, 0.0 = 100% regrind"
          />
        </div>
      </div>

      {/* 2.7 Energy & Labor */}
      {showEnergyCalc && <EnergyLaborCalculator onClose={() => setShowEnergyCalc(false)} />}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-4">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">2.7 Energy & Labor</h2>
          <button
            onClick={() => setShowEnergyCalc(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors"
          >
            <span>⚡</span> Calculate
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <InputField label="Machine Consumption" value={inp.machineConsumption} onChange={(v) => set({ machineConsumption: n(v) })} type="number" step="1" unit="kWh/h" />
          <InputField label="Auxiliary Equipment" value={inp.auxiliaryEquipment} onChange={(v) => set({ auxiliaryEquipment: n(v) })} type="number" step="1" unit="kWh/h" />
          <InputField label="Energy Price" value={inp.energyPrice} onChange={(v) => set({ energyPrice: n(v) })} type="number" step="0.01" unit="curr/kWh" />
          <InputField label="Labor Rate" value={inp.laborRate} onChange={(v) => set({ laborRate: n(v) })} type="number" step="0.5" unit="curr/h" tooltip="Fully loaded direct labor rate" />
          <InputField label="Operators / Machine" value={inp.operatorsPerMachine} onChange={(v) => set({ operatorsPerMachine: n(v) })} type="number" step="0.1" unit="FTE" />
          <InputField label="Indirect Labor Factor" value={inp.indirectLaborFactor} onChange={(v) => set({ indirectLaborFactor: n(v) })} type="number" step="0.01" min={0} max={1} unit="0–1" tooltip="Indirect as % of direct labor cost" />
        </div>
      </div>

      {/* 2.8 Tooling */}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="2.8 Tooling" />
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Tool Cost" value={inp.toolCost} onChange={(v) => set({ toolCost: n(v) })} type="number" step="1000" unit="curr total" />
          <InputField label="Tool Lifetime" value={inp.toolLifetime} onChange={(v) => set({ toolLifetime: ni(v) })} type="number" unit="shots" tooltip="Total expected shot life" />
          <SelectField
            label="Tool Ownership"
            value={String(inp.toolOwnership)}
            onChange={(v) => set({ toolOwnership: parseInt(v, 10) as 0 | 1 })}
            options={[{ value: '1', label: '1 — Supplier (we own)' }, { value: '0', label: '0 — Customer (they own)' }]}
            tooltip="If supplier owns tool, financing cost applies"
          />
          <InputField
            label="Tool Maintenance/yr"
            value={inp.toolMaintenanceYear}
            onChange={(v) => set({ toolMaintenanceYear: n(v) })}
            type="number" step="0.005" min={0} max={1} unit="0–1"
            tooltip="Annual maintenance as % of tool cost"
          />
        </div>
      </div>

      {/* 2.9 Overhead */}
      {showOverheadCalc && <OverheadCalculator onClose={() => setShowOverheadCalc(false)} />}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <div className="flex items-center justify-between border-b border-slate-700 pb-2 mb-4">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">2.9 Overhead</h2>
          <button
            onClick={() => setShowOverheadCalc(true)}
            className="flex items-center gap-1.5 px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors"
          >
            <span>⚡</span> Calculate
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Fixed Overhead/yr" value={inp.fixedOverhead} onChange={(v) => set({ fixedOverhead: n(v) })} type="number" step="1000" unit="curr/machine/yr" />
          <InputField
            label="Variable Overhead Rate"
            value={inp.variableOverheadRate}
            onChange={(v) => set({ variableOverheadRate: n(v) })}
            type="number" step="0.01" min={0} max={1} unit="0–1"
            tooltip="% of direct costs (mat + labor + energy)"
          />
        </div>
      </div>

      {/* Legend */}
      <div className="bg-slate-800/40 rounded-lg p-4 border border-slate-700">
        <SectionHeader title="Legend" />
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> <span className="text-slate-300">Blue input = editable field</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-slate-400 inline-block" /> <span className="text-slate-300">Black/grey = calculated (read-only)</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> <span className="text-slate-300">Green = cross-tab link / KPI</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-yellow-500 inline-block" /> <span className="text-slate-300">Yellow = key assumption with guard</span></div>
        </div>
      </div>
    </div>
  );
}
