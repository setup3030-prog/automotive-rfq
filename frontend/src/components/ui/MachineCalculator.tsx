import React, { useState, useEffect } from 'react';
import { useRfq } from '../../context/RfqContext';

interface Props { onClose: () => void; }

function n(v: string) { return parseFloat(v) || 0; }

// ─── Material presets ────────────────────────────────────────────────────────
const MATERIALS: Record<string, { a: number; tMelt: number; tMold: number; tEject: number; clampFactor: number; label: string }> = {
  PP:   { a: 0.88e-7, tMelt: 230, tMold:  30, tEject:  95, clampFactor: 3.0, label: 'PP (Polypropylene)' },
  HDPE: { a: 0.75e-7, tMelt: 230, tMold:  25, tEject:  90, clampFactor: 2.5, label: 'HDPE' },
  ABS:  { a: 1.00e-7, tMelt: 240, tMold:  50, tEject:  90, clampFactor: 3.5, label: 'ABS' },
  PC:   { a: 1.20e-7, tMelt: 290, tMold:  80, tEject: 130, clampFactor: 4.5, label: 'PC (Polycarbonate)' },
  PA6:  { a: 1.10e-7, tMelt: 260, tMold:  70, tEject: 130, clampFactor: 4.0, label: 'PA6 / PA6-GF' },
  PA66: { a: 1.15e-7, tMelt: 280, tMold:  80, tEject: 140, clampFactor: 4.0, label: 'PA66 / PA66-GF' },
  POM:  { a: 0.95e-7, tMelt: 210, tMold:  60, tEject: 120, clampFactor: 3.5, label: 'POM (Acetal)' },
  PBT:  { a: 1.00e-7, tMelt: 260, tMold:  60, tEject: 120, clampFactor: 3.5, label: 'PBT / PBT-GF' },
};

const STANDARD_CAVITIES = [1, 2, 4, 6, 8, 12, 16, 24, 32, 48, 64];

function calcCoolingTime(wallMm: number, mat: typeof MATERIALS[string], tMeltOverride?: number, tMoldOverride?: number, tEjectOverride?: number) {
  const s = wallMm / 1000; // m
  const { a } = mat;
  const tMelt = tMeltOverride ?? mat.tMelt;
  const tMold = tMoldOverride ?? mat.tMold;
  const tEject = tEjectOverride ?? mat.tEject;
  const dTtotal = tMelt - tMold;
  const dTeject = tEject - tMold;
  if (dTtotal <= 0 || dTeject <= 0 || dTeject >= dTtotal || s <= 0 || a <= 0) return 0;
  const ratio = (Math.PI / 4) * (dTtotal / dTeject);
  if (ratio <= 1) return 0;
  return (s * s) / (Math.PI * Math.PI * a) * Math.log(ratio);
}

function ResultRow({ label, value, unit, highlight, warn }: { label: string; value: string; unit?: string; highlight?: boolean; warn?: boolean }) {
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
        {unit && <span className="text-xs text-slate-500 w-16 shrink-0">{unit}</span>}
      </div>
    </label>
  );
}

export function MachineCalculator({ onClose }: Props) {
  const { state, dispatch } = useRfq();
  const inp = state.input;
  const cur = inp.currency;

  // ── 1. Machine Hourly Rate ──────────────────────────────────────────────────
  const [machPrice, setMachPrice]     = useState('800000');
  const [deprYears, setDeprYears]     = useState('8');
  const [maintRate, setMaintRate]     = useState('0.04');
  const [floorArea, setFloorArea]     = useState('25');
  const [floorRent, setFloorRent]     = useState('120');
  const [adminOh, setAdminOh]         = useState('15');
  const workHours = inp.workingHoursYear || 6000;

  const dep    = n(machPrice) / (n(deprYears) * workHours);
  const maint  = n(machPrice) * n(maintRate)  / workHours;
  const floor  = n(floorArea) * n(floorRent)  / workHours;
  const admin  = n(adminOh);
  const mhr    = dep + maint + floor + admin;

  // ── 2. Cycle Time ───────────────────────────────────────────────────────────
  const [matKey, setMatKey]         = useState('PP');
  const mat = MATERIALS[matKey];
  const [wallMm, setWallMm]         = useState('2.5');
  const [tMelt, setTMelt]           = useState(String(mat.tMelt));
  const [tMold, setTMold]           = useState(String(mat.tMold));
  const [tEject, setTEject]         = useState(String(mat.tEject));
  const [tInject, setTInject]       = useState('3');
  const [tOpenClose, setTOpenClose] = useState('4');

  useEffect(() => {
    setTMelt(String(MATERIALS[matKey].tMelt));
    setTMold(String(MATERIALS[matKey].tMold));
    setTEject(String(MATERIALS[matKey].tEject));
  }, [matKey]);

  const tCool     = calcCoolingTime(n(wallMm), mat, n(tMelt), n(tMold), n(tEject));
  const tActual   = tCool + n(tInject) + n(tOpenClose);
  const tOptimized = Math.max(tActual * 0.90, tActual - 2);

  // ── 3. Cavities Optimizer ───────────────────────────────────────────────────
  const [oeeCalc, setOeeCalc]   = useState(String(inp.oee || 0.80));
  const [useCalcCycle, setUseCalcCycle] = useState(true);
  const [manualCycle, setManualCycle] = useState(String(inp.cycleTimeActual || 30));

  const cycleForCav = useCalcCycle ? tActual : n(manualCycle);
  const shotsPerYear = cycleForCav > 0 ? workHours * 3600 / cycleForCav * n(oeeCalc) : 0;
  const minCavities = shotsPerYear > 0 ? Math.ceil(inp.volMid / shotsPerYear) : 1;
  const suggestedCav = STANDARD_CAVITIES.find(c => c >= minCavities) ?? STANDARD_CAVITIES[STANDARD_CAVITIES.length - 1];
  const utilizationWith = shotsPerYear > 0 ? inp.volMid / (shotsPerYear * suggestedCav) : 0;

  // ── 4. Clamping Force ───────────────────────────────────────────────────────
  const [projLen, setProjLen]     = useState('100');
  const [projWid, setProjWid]     = useState('80');
  const [clampMat, setClampMat]   = useState('PP');
  const [cavForClamp, setCavForClamp] = useState(String(inp.cavities || 1));
  const [safetyFactor, setSafetyFactor] = useState('1.15');

  const projAreaCm2 = (n(projLen) * n(projWid)) / 100;
  const clampPerCav = projAreaCm2 * MATERIALS[clampMat].clampFactor;
  const totalClamp  = clampPerCav * n(cavForClamp) * n(safetyFactor);

  // ── Apply ───────────────────────────────────────────────────────────────────
  const [applyMHR,    setApplyMHR]    = useState(true);
  const [applyCycle,  setApplyCycle]  = useState(true);
  const [applyCav,    setApplyCav]    = useState(false);
  const [applyClamp,  setApplyClamp]  = useState(false);

  function handleApply() {
    const payload: Record<string, number> = {};
    if (applyMHR)   payload.machineHourlyRate = Math.round(mhr * 100) / 100;
    if (applyCycle) {
      payload.cycleTimeActual    = Math.round(tActual * 10) / 10;
      payload.cycleTimeOptimized = Math.round(tOptimized * 10) / 10;
    }
    if (applyCav)   payload.cavities    = suggestedCav;
    if (applyClamp) payload.machineSize = Math.round(totalClamp / 10) * 10;
    dispatch({ type: 'SET_INPUT', payload });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Machine & Process Calculator</h2>
            <p className="text-xs text-slate-400 mt-0.5">Zaznacz sekcje do zastosowania, kliknij Apply</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg font-bold leading-none">✕</button>
        </div>

        <div className="p-5 space-y-5">

          {/* ── 1. MACHINE HOURLY RATE ── */}
          <SectionBox title="1 · Machine Hourly Rate">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Cena maszyny" value={machPrice} set={setMachPrice} unit={cur} step="10000" />
              <Field label="Amortyzacja" value={deprYears} set={setDeprYears} unit="lat" />
              <Field label="Utrzymanie ruchu" value={maintRate} set={setMaintRate} unit="(0–1)" step="0.005" note="np. 0.04 = 4%/rok" />
              <Field label="Czynsz hali" value={floorRent} set={setFloorRent} unit={`${cur}/m²/rok`} />
              <Field label="Powierzchnia maszyny" value={floorArea} set={setFloorArea} unit="m²" />
              <Field label="Overhead admin/h" value={adminOh} set={setAdminOh} unit={`${cur}/h`} note="IT, zarząd, etc." />
            </div>
            <div className="text-[10px] text-slate-500 mb-2">
              Baza: {workHours.toLocaleString()} h/rok (z Working Hours/Year)
            </div>
            <div className="bg-slate-900/60 rounded p-2 space-y-1">
              <ResultRow label="Amortyzacja/h" value={dep.toFixed(2)} unit={`${cur}/h`} />
              <ResultRow label="Utrzymanie/h" value={maint.toFixed(2)} unit={`${cur}/h`} />
              <ResultRow label="Czynsz hali/h" value={floor.toFixed(2)} unit={`${cur}/h`} />
              <ResultRow label="Overhead/h" value={admin.toFixed(2)} unit={`${cur}/h`} />
              <div className="border-t border-slate-700 mt-1 pt-1">
                <ResultRow label="= Machine Hourly Rate" value={mhr.toFixed(2)} unit={`${cur}/h`} highlight />
              </div>
            </div>
          </SectionBox>

          {/* ── 2. CYCLE TIME ── */}
          <SectionBox title="2 · Cycle Time Estimator (Rosato's formula)">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-400">Materiał</span>
                <select value={matKey} onChange={(e) => setMatKey(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500">
                  {Object.entries(MATERIALS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </label>
              <Field label="Grubość ścianki" value={wallMm} set={setWallMm} unit="mm" step="0.1" />
              <Field label="T melt (stopiony)" value={tMelt} set={setTMelt} unit="°C" />
              <Field label="T mold (forma)" value={tMold} set={setTMold} unit="°C" />
              <Field label="T eject (wyjęcie)" value={tEject} set={setTEject} unit="°C" />
              <Field label="Czas wtrysku" value={tInject} set={setTInject} unit="s" step="0.5" />
              <Field label="Otwarcie formy + wyrzut" value={tOpenClose} set={setTOpenClose} unit="s" step="0.5" />
            </div>
            <div className="bg-slate-900/60 rounded p-2 space-y-1">
              <ResultRow label="Czas chłodzenia (formuła)" value={tCool.toFixed(1)} unit="s" />
              <ResultRow label="+ wtrysk" value={n(tInject).toFixed(1)} unit="s" />
              <ResultRow label="+ otwarcie/wyrzut" value={n(tOpenClose).toFixed(1)} unit="s" />
              <div className="border-t border-slate-700 mt-1 pt-1">
                <ResultRow label="= Cycle Time (Actual)" value={tActual.toFixed(1)} unit="s" highlight />
                <ResultRow label="= Cycle Time (Optimized, −10%)" value={tOptimized.toFixed(1)} unit="s" highlight />
              </div>
            </div>
            {tCool <= 0 && (
              <div className="mt-2 text-xs text-yellow-400 bg-yellow-900/20 rounded px-2 py-1">
                ⚠ Sprawdź temperatury — T eject musi być między T mold a T melt
              </div>
            )}
          </SectionBox>

          {/* ── 3. CAVITIES ── */}
          <SectionBox title="3 · Cavities Optimizer">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-400">Cycle time do obliczeń</span>
                <div className="flex gap-2 items-center">
                  <button onClick={() => setUseCalcCycle(true)}
                    className={`px-2 py-1 rounded text-xs ${useCalcCycle ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                    Z kalkulatora ({tActual.toFixed(1)}s)
                  </button>
                  <button onClick={() => setUseCalcCycle(false)}
                    className={`px-2 py-1 rounded text-xs ${!useCalcCycle ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                    Ręcznie
                  </button>
                </div>
              </div>
              {!useCalcCycle && (
                <Field label="Cycle time (ręczny)" value={manualCycle} set={setManualCycle} unit="s" step="0.5" />
              )}
              <Field label="OEE" value={oeeCalc} set={setOeeCalc} unit="0–1" step="0.01" />
            </div>
            <div className="bg-slate-900/60 rounded p-2 space-y-1">
              <ResultRow label="Strzałów / rok (1 gniazdo)" value={Math.round(shotsPerYear).toLocaleString()} unit="shots/yr" />
              <ResultRow label="Wolumen RFQ" value={(inp.volMid || 0).toLocaleString()} unit="pcs/yr" />
              <ResultRow label="Min. liczba gniazd" value={minCavities.toString()} />
              <div className="border-t border-slate-700 mt-1 pt-1">
                <ResultRow label="= Sugerowane gniazda (standard)" value={suggestedCav.toString()} highlight />
                <ResultRow
                  label="Wykorzystanie maszyny"
                  value={(utilizationWith * 100).toFixed(1)}
                  unit="%"
                  warn={utilizationWith > 0.9}
                />
              </div>
            </div>
          </SectionBox>

          {/* ── 4. CLAMPING FORCE ── */}
          <SectionBox title="4 · Clamping Force (Machine Size)">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Proj. długość części" value={projLen} set={setProjLen} unit="mm" />
              <Field label="Proj. szerokość części" value={projWid} set={setProjWid} unit="mm" />
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-400">Materiał (czynnik zaciskowy)</span>
                <select value={clampMat} onChange={(e) => setClampMat(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-blue-500">
                  {Object.entries(MATERIALS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label} — {v.clampFactor} kN/cm²</option>
                  ))}
                </select>
              </label>
              <Field label="Liczba gniazd" value={cavForClamp} set={setCavForClamp} unit="szt" />
              <Field label="Współczynnik bezpiecz." value={safetyFactor} set={setSafetyFactor} unit="(1.1–1.25)" step="0.05" />
            </div>
            <div className="bg-slate-900/60 rounded p-2 space-y-1">
              <ResultRow label="Pow. rzut. (1 gniazdo)" value={projAreaCm2.toFixed(1)} unit="cm²" />
              <ResultRow label={`Czynnik (${MATERIALS[clampMat].clampFactor} kN/cm²)`} value={clampPerCav.toFixed(0)} unit="kN / gniazdo" />
              <ResultRow label={`× ${cavForClamp} gniazd × bezp.`} value="" unit="" />
              <div className="border-t border-slate-700 mt-1 pt-1">
                <ResultRow label="= Min. siła zaciskająca" value={totalClamp.toFixed(0)} unit="kN" highlight />
              </div>
            </div>
          </SectionBox>

          {/* ── APPLY ── */}
          <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Zastosuj do RFQ</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { key: 'mhr', val: applyMHR, set: setApplyMHR, label: 'Machine Hourly Rate', result: `${mhr.toFixed(2)} ${cur}/h` },
                { key: 'cycle', val: applyCycle, set: setApplyCycle, label: 'Cycle Time (Actual + Optimized)', result: `${tActual.toFixed(1)}s / ${tOptimized.toFixed(1)}s` },
                { key: 'cav', val: applyCav, set: setApplyCav, label: 'Cavities', result: `${suggestedCav} gniazd` },
                { key: 'clamp', val: applyClamp, set: setApplyClamp, label: 'Machine Size (kN)', result: `${Math.round(totalClamp / 10) * 10} kN` },
              ].map(({ key, val, set, label, result }) => (
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
              disabled={!applyMHR && !applyCycle && !applyCav && !applyClamp}
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
