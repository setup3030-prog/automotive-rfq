import React, { useState } from 'react';
import { useRfq } from '../../context/RfqContext';

interface Props { onClose: () => void; }

function n(v: string) { return parseFloat(v) || 0; }

function ResultRow({ label, value, unit, highlight, warn }: {
  label: string; value: string; unit?: string; highlight?: boolean; warn?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center py-1 border-b border-slate-700/40 last:border-0 ${highlight ? 'text-blue-300 font-semibold' : warn ? 'text-yellow-300' : 'text-slate-400'}`}>
      <span className="text-xs">{label}</span>
      <span className="font-mono text-xs">{value}{unit ? ` ${unit}` : ''}</span>
    </div>
  );
}

function SectionBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/60 rounded-lg p-4">
      <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 border-b border-slate-700 pb-2">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value, set, unit, step = '1', min = '0', note }: {
  label: string; value: string; set: (v: string) => void;
  unit?: string; step?: string; min?: string; note?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-400">{label}{note && <span className="ml-1 text-slate-500">({note})</span>}</span>
      <div className="flex items-center gap-1">
        <input type="number" step={step} min={min} value={value} onChange={(e) => set(e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500" />
        {unit && <span className="text-xs text-slate-500 w-20 shrink-0">{unit}</span>}
      </div>
    </label>
  );
}

export function OverheadCalculator({ onClose }: Props) {
  const { state, dispatch } = useRfq();
  const inp = state.input;
  const cur = inp.currency;

  // ── 1. Fixed Overhead breakdown ────────────────────────────────────────────
  // Rent
  const [rentPerM2, setRentPerM2]       = useState('120');   // curr/m²/yr
  const [machineArea, setMachineArea]   = useState('30');    // m² allocated per machine

  // Utilities (water, compressed air, heating – not energy)
  const [utilitiesYear, setUtilitiesYear] = useState('5000'); // curr/machine/yr

  // IT, admin, management allocation
  const [adminYear, setAdminYear]       = useState('8000');  // curr/machine/yr

  // Insurance & property tax
  const [insuranceYear, setInsuranceYear] = useState('3000'); // curr/machine/yr

  // Other fixed (certifications, waste disposal contracts, etc.)
  const [otherFixedYear, setOtherFixedYear] = useState('2000');

  const rentYear         = n(rentPerM2) * n(machineArea);
  const fixedOverheadCalc = rentYear + n(utilitiesYear) + n(adminYear) + n(insuranceYear) + n(otherFixedYear);

  // ── 2. Variable Overhead rate ──────────────────────────────────────────────
  // Variable overhead items as % of direct costs (mat + labor + energy)
  const [qualityPct, setQualityPct]     = useState('2.0');   // quality control, inspection
  const [scrapHandlingPct, setScrapHandlingPct] = useState('0.5'); // scrap disposal & handling
  const [warehousePct, setWarehousePct] = useState('1.0');   // WIP & FG warehousing
  const [itSoftwarePct, setItSoftwarePct] = useState('0.5'); // MES, ERP allocation
  const [otherVarPct, setOtherVarPct]   = useState('1.0');   // other variable costs

  const variableOverheadCalc = (
    n(qualityPct) + n(scrapHandlingPct) + n(warehousePct) +
    n(itSoftwarePct) + n(otherVarPct)
  ) / 100;

  // ── Apply ──────────────────────────────────────────────────────────────────
  const [applyFixed,    setApplyFixed]    = useState(true);
  const [applyVariable, setApplyVariable] = useState(true);

  function handleApply() {
    const payload: Record<string, number> = {};
    if (applyFixed)    payload.fixedOverhead        = Math.round(fixedOverheadCalc);
    if (applyVariable) payload.variableOverheadRate = Math.round(variableOverheadCalc * 10000) / 10000;
    dispatch({ type: 'SET_INPUT', payload });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Overhead Calculator</h2>
            <p className="text-xs text-slate-400 mt-0.5">Zaznacz sekcje do zastosowania, kliknij Apply</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg font-bold leading-none">✕</button>
        </div>

        <div className="p-5 space-y-5">

          {/* ── 1. FIXED OVERHEAD ── */}
          <SectionBox title="1 · Fixed Overhead (curr / machine / yr)">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Czynsz / m² / rok" value={rentPerM2} set={setRentPerM2} unit={`${cur}/m²/yr`} step="10" />
              <Field label="Powierzchnia maszyny" value={machineArea} set={setMachineArea} unit="m²" step="1" note="łącznie z buforem" />
              <Field label="Media (woda, sprężone powietrze, ogrzewanie)" value={utilitiesYear} set={setUtilitiesYear} unit={`${cur}/yr`} step="500" />
              <Field label="IT / ERP / admin alokacja" value={adminYear} set={setAdminYear} unit={`${cur}/yr`} step="500" />
              <Field label="Ubezpieczenie i podatek od nieruchomości" value={insuranceYear} set={setInsuranceYear} unit={`${cur}/yr`} step="500" />
              <Field label="Inne koszty stałe" value={otherFixedYear} set={setOtherFixedYear} unit={`${cur}/yr`} step="500" />
            </div>
            <div className="bg-slate-900/60 rounded p-2 space-y-1">
              <ResultRow label={`Czynsz (${machineArea} m² × ${rentPerM2} ${cur})`} value={rentYear.toFixed(0)} unit={`${cur}/yr`} />
              <ResultRow label="Media" value={n(utilitiesYear).toFixed(0)} unit={`${cur}/yr`} />
              <ResultRow label="IT / admin" value={n(adminYear).toFixed(0)} unit={`${cur}/yr`} />
              <ResultRow label="Ubezpieczenie" value={n(insuranceYear).toFixed(0)} unit={`${cur}/yr`} />
              <ResultRow label="Inne" value={n(otherFixedYear).toFixed(0)} unit={`${cur}/yr`} />
              <div className="border-t border-slate-700 mt-1 pt-1">
                <ResultRow label="= Fixed Overhead / machine / yr" value={fixedOverheadCalc.toFixed(0)} unit={cur} highlight />
              </div>
            </div>
            {inp.workingHoursYear > 0 && (
              <div className="mt-2 text-xs text-slate-500">
                → Per hour: <span className="font-mono text-slate-300">{(fixedOverheadCalc / inp.workingHoursYear).toFixed(2)} {cur}/h</span>
                <span className="ml-2">({inp.workingHoursYear.toLocaleString()} h/yr z RFQ)</span>
              </div>
            )}
          </SectionBox>

          {/* ── 2. VARIABLE OVERHEAD ── */}
          <SectionBox title="2 · Variable Overhead Rate (% of direct costs)">
            <div className="text-xs text-slate-500 mb-3">
              Direct costs = material + labor + energy. Overhead alokowany procentowo.
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Kontrola jakości / inspekcja" value={qualityPct} set={setQualityPct} unit="%" step="0.1" />
              <Field label="Utylizacja odpadów / złomu" value={scrapHandlingPct} set={setScrapHandlingPct} unit="%" step="0.1" />
              <Field label="Magazynowanie WIP/FG" value={warehousePct} set={setWarehousePct} unit="%" step="0.1" />
              <Field label="IT / MES / oprogramowanie" value={itSoftwarePct} set={setItSoftwarePct} unit="%" step="0.1" />
              <Field label="Inne koszty zmienne" value={otherVarPct} set={setOtherVarPct} unit="%" step="0.1" />
            </div>
            <div className="bg-slate-900/60 rounded p-2 space-y-1">
              <ResultRow label="Jakość" value={`${n(qualityPct).toFixed(1)}%`} />
              <ResultRow label="Utylizacja złomu" value={`${n(scrapHandlingPct).toFixed(1)}%`} />
              <ResultRow label="Magazyn WIP/FG" value={`${n(warehousePct).toFixed(1)}%`} />
              <ResultRow label="IT / MES" value={`${n(itSoftwarePct).toFixed(1)}%`} />
              <ResultRow label="Inne zmienne" value={`${n(otherVarPct).toFixed(1)}%`} />
              <div className="border-t border-slate-700 mt-1 pt-1">
                <ResultRow
                  label="= Variable Overhead Rate"
                  value={`${(variableOverheadCalc * 100).toFixed(1)}% (${variableOverheadCalc.toFixed(4)})`}
                  highlight
                  warn={variableOverheadCalc > 0.15}
                />
              </div>
            </div>
            {variableOverheadCalc > 0.15 && (
              <div className="mt-2 text-xs text-yellow-400 bg-yellow-900/20 rounded px-2 py-1">
                ⚠ Wysoki wskaźnik overhead — typowy zakres 3–12% dla wytryskarek
              </div>
            )}
          </SectionBox>

          {/* ── APPLY ── */}
          <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Zastosuj do RFQ</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {([
                { key: 'fixed',    val: applyFixed,    set: setApplyFixed,    label: 'Fixed Overhead / yr',    result: `${fixedOverheadCalc.toFixed(0)} ${cur}/mach/yr` },
                { key: 'variable', val: applyVariable, set: setApplyVariable, label: 'Variable Overhead Rate', result: `${(variableOverheadCalc * 100).toFixed(1)}%` },
              ] as { key: string; val: boolean; set: (v: boolean) => void; label: string; result: string }[]).map(({ key, val, set, label, result }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer bg-slate-800/60 rounded p-2">
                  <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)}
                    className="accent-blue-500 w-3.5 h-3.5 shrink-0" />
                  <div>
                    <div className="text-xs text-slate-300">{label}</div>
                    <div className="font-mono text-xs text-blue-300">{result}</div>
                  </div>
                </label>
              ))}
            </div>
            <button
              onClick={handleApply}
              disabled={!applyFixed && !applyVariable}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Apply to RFQ
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
