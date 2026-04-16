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
        {unit && <span className="text-xs text-slate-500 w-16 shrink-0">{unit}</span>}
      </div>
    </label>
  );
}

export function EnergyLaborCalculator({ onClose }: Props) {
  const { state, dispatch } = useRfq();
  const inp = state.input;
  const cur = inp.currency;

  // ── 1. Energy Price ────────────────────────────────────────────────────────
  type TariffMode = 'flat' | 'blended';
  const [tariffMode, setTariffMode] = useState<TariffMode>('flat');
  const [flatPrice, setFlatPrice]   = useState(String(inp.energyPrice || 0.65));
  const [dayPrice, setDayPrice]     = useState('0.85');
  const [nightPrice, setNightPrice] = useState('0.40');
  const [nightRatio, setNightRatio] = useState('0.35');   // fraction of hours at night tariff

  const energyPriceCalc = tariffMode === 'flat'
    ? n(flatPrice)
    : n(dayPrice) * (1 - n(nightRatio)) + n(nightPrice) * n(nightRatio);

  // ── 2. Machine Power ───────────────────────────────────────────────────────
  type PowerMode = 'from_tonnage' | 'manual';
  const [powerMode, setPowerMode]         = useState<PowerMode>(inp.machineConsumption > 0 ? 'manual' : 'from_tonnage');
  const [kWperKN, setKWperKN]             = useState('0.06');   // rule of thumb kW per kN clamping force
  const [manualConsumption, setManualConsumption] = useState(String(inp.machineConsumption || 30));

  const tonnageKN = inp.machineSize || 0;
  const consumptionFromTonnage = tonnageKN * n(kWperKN);
  const machineConsumptionCalc = powerMode === 'from_tonnage' ? consumptionFromTonnage : n(manualConsumption);

  // ── 3. Auxiliary Equipment ─────────────────────────────────────────────────
  const [dryerKW, setDryerKW]         = useState('4');
  const [robotKW, setRobotKW]         = useState('2');
  const [chillerKW, setChillerKW]     = useState('3');
  const [conveyorKW, setConveyorKW]   = useState('1');
  const [otherAuxKW, setOtherAuxKW]   = useState('0');

  const auxiliaryCalc = n(dryerKW) + n(robotKW) + n(chillerKW) + n(conveyorKW) + n(otherAuxKW);

  // ── 4. Labor Rate ──────────────────────────────────────────────────────────
  const [baseWage, setBaseWage]             = useState('35');    // gross hourly wage
  const [burdenMultiplier, setBurdenMultiplier] = useState('1.22');  // employer costs multiplier (ZUS etc.)
  const [shiftBonus, setShiftBonus]         = useState('0');    // shift/bonus addition in curr/h
  const [ppe, setPpe]                       = useState('0.50'); // PPE & uniforms spread per hour

  const laborRateCalc = n(baseWage) * n(burdenMultiplier) + n(shiftBonus) + n(ppe);

  // ── 5. Operators & Indirect ────────────────────────────────────────────────
  const [operators, setOperators]           = useState(String(inp.operatorsPerMachine || 1));
  const [indirectFactor, setIndirectFactor] = useState(String(inp.indirectLaborFactor || 0.25));

  // ── Apply selections ───────────────────────────────────────────────────────
  const [applyEnergy,    setApplyEnergy]    = useState(true);
  const [applyConsump,   setApplyConsump]   = useState(true);
  const [applyAux,       setApplyAux]       = useState(true);
  const [applyLabor,     setApplyLabor]     = useState(true);
  const [applyOperators, setApplyOperators] = useState(false);
  const [applyIndirect,  setApplyIndirect]  = useState(false);

  function handleApply() {
    const payload: Record<string, number> = {};
    if (applyEnergy)    payload.energyPrice          = Math.round(energyPriceCalc * 10000) / 10000;
    if (applyConsump)   payload.machineConsumption   = Math.round(machineConsumptionCalc * 100) / 100;
    if (applyAux)       payload.auxiliaryEquipment   = Math.round(auxiliaryCalc * 100) / 100;
    if (applyLabor)     payload.laborRate            = Math.round(laborRateCalc * 100) / 100;
    if (applyOperators) payload.operatorsPerMachine  = n(operators);
    if (applyIndirect)  payload.indirectLaborFactor  = n(indirectFactor);
    dispatch({ type: 'SET_INPUT', payload });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Energy & Labor Calculator</h2>
            <p className="text-xs text-slate-400 mt-0.5">Zaznacz sekcje do zastosowania, kliknij Apply</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg font-bold leading-none">✕</button>
        </div>

        <div className="p-5 space-y-5">

          {/* ── 1. ENERGY PRICE ── */}
          <SectionBox title="1 · Energy Price (curr/kWh)">
            <div className="flex gap-2 mb-4">
              {([['flat', 'Flat rate'], ['blended', 'Day / Night blend']] as [TariffMode, string][]).map(([m, label]) => (
                <button key={m} onClick={() => setTariffMode(m)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${tariffMode === m ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                  {label}
                </button>
              ))}
            </div>

            {tariffMode === 'flat' && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Field label="Cena energii" value={flatPrice} set={setFlatPrice} unit={`${cur}/kWh`} step="0.01" />
              </div>
            )}

            {tariffMode === 'blended' && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Field label="Taryfa dzienna" value={dayPrice} set={setDayPrice} unit={`${cur}/kWh`} step="0.01" />
                <Field label="Taryfa nocna" value={nightPrice} set={setNightPrice} unit={`${cur}/kWh`} step="0.01" />
                <Field label="Udział nocny" value={nightRatio} set={setNightRatio} unit="0–1" step="0.05" note="np. 0.35 = 35% nocna" />
              </div>
            )}

            <div className="bg-slate-900/60 rounded p-2 space-y-1">
              {tariffMode === 'blended' && <>
                <ResultRow label={`Dzienna (${(1 - n(nightRatio)) * 100 | 0}%)`} value={(n(dayPrice) * (1 - n(nightRatio))).toFixed(4)} unit={`${cur}/kWh`} />
                <ResultRow label={`Nocna (${n(nightRatio) * 100 | 0}%)`} value={(n(nightPrice) * n(nightRatio)).toFixed(4)} unit={`${cur}/kWh`} />
                <div className="border-t border-slate-700 mt-1 pt-1">
                  <ResultRow label="= Blended energy price" value={energyPriceCalc.toFixed(4)} unit={`${cur}/kWh`} highlight />
                </div>
              </>}
              {tariffMode === 'flat' && (
                <ResultRow label="= Energy price" value={energyPriceCalc.toFixed(4)} unit={`${cur}/kWh`} highlight />
              )}
            </div>
          </SectionBox>

          {/* ── 2. MACHINE POWER ── */}
          <SectionBox title="2 · Machine Power Consumption (kWh/h)">
            <div className="flex gap-2 mb-4">
              {([['from_tonnage', `Z tonażu (${tonnageKN} kN)`], ['manual', 'Ręcznie']] as [PowerMode, string][]).map(([m, label]) => (
                <button key={m} onClick={() => setPowerMode(m)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${powerMode === m ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                  {label}
                </button>
              ))}
            </div>

            {powerMode === 'from_tonnage' && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Field label="kW / kN (reguła)" value={kWperKN} set={setKWperKN} unit="kW/kN" step="0.005" note="typowo 0.04–0.08" />
                <div className="flex flex-col justify-center text-xs text-slate-400">
                  <span>Siła z RFQ: <span className="font-mono text-slate-200">{tonnageKN} kN</span></span>
                  {tonnageKN === 0 && <span className="text-yellow-400 mt-1">⚠ Uzupełnij Machine Size w 2.5</span>}
                </div>
              </div>
            )}

            {powerMode === 'manual' && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Field label="Pobór maszyny" value={manualConsumption} set={setManualConsumption} unit="kWh/h" step="1" />
              </div>
            )}

            <div className="bg-slate-900/60 rounded p-2 space-y-1">
              <ResultRow label="= Machine consumption" value={machineConsumptionCalc.toFixed(1)} unit="kWh/h" highlight />
            </div>
          </SectionBox>

          {/* ── 3. AUXILIARY EQUIPMENT ── */}
          <SectionBox title="3 · Auxiliary Equipment (kWh/h)">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <Field label="Suszarka / Dryer" value={dryerKW} set={setDryerKW} unit="kWh/h" step="0.5" />
              <Field label="Robot / Manipulator" value={robotKW} set={setRobotKW} unit="kWh/h" step="0.5" />
              <Field label="Chiller / Termostat" value={chillerKW} set={setChillerKW} unit="kWh/h" step="0.5" />
              <Field label="Przenośnik / Conveyor" value={conveyorKW} set={setConveyorKW} unit="kWh/h" step="0.5" />
              <Field label="Inne urządzenia" value={otherAuxKW} set={setOtherAuxKW} unit="kWh/h" step="0.5" />
            </div>
            <div className="bg-slate-900/60 rounded p-2 space-y-1">
              <ResultRow label="Dryer" value={n(dryerKW).toFixed(1)} unit="kWh/h" />
              <ResultRow label="Robot" value={n(robotKW).toFixed(1)} unit="kWh/h" />
              <ResultRow label="Chiller" value={n(chillerKW).toFixed(1)} unit="kWh/h" />
              <ResultRow label="Conveyor" value={n(conveyorKW).toFixed(1)} unit="kWh/h" />
              <ResultRow label="Inne" value={n(otherAuxKW).toFixed(1)} unit="kWh/h" />
              <div className="border-t border-slate-700 mt-1 pt-1">
                <ResultRow label="= Auxiliary total" value={auxiliaryCalc.toFixed(1)} unit="kWh/h" highlight />
              </div>
            </div>
          </SectionBox>

          {/* ── 4. LABOR RATE ── */}
          <SectionBox title="4 · Labor Rate (curr/h)">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Stawka brutto" value={baseWage} set={setBaseWage} unit={`${cur}/h`} step="0.5" />
              <Field label="Mnożnik ZUS / narzuty" value={burdenMultiplier} set={setBurdenMultiplier} unit="(np. 1.22)" step="0.01" min="1" note="PL ≈ 1.22" />
              <Field label="Dodatki zmianowe" value={shiftBonus} set={setShiftBonus} unit={`${cur}/h`} step="0.5" />
              <Field label="BHP / odzież robocza" value={ppe} set={setPpe} unit={`${cur}/h`} step="0.1" />
            </div>
            <div className="bg-slate-900/60 rounded p-2 space-y-1">
              <ResultRow label={`Stawka brutto × ${burdenMultiplier}`} value={(n(baseWage) * n(burdenMultiplier)).toFixed(2)} unit={`${cur}/h`} />
              <ResultRow label="+ Dodatki zmianowe" value={n(shiftBonus).toFixed(2)} unit={`${cur}/h`} />
              <ResultRow label="+ BHP/odzież" value={n(ppe).toFixed(2)} unit={`${cur}/h`} />
              <div className="border-t border-slate-700 mt-1 pt-1">
                <ResultRow label="= Fully loaded labor rate" value={laborRateCalc.toFixed(2)} unit={`${cur}/h`} highlight />
              </div>
            </div>
          </SectionBox>

          {/* ── 5. OPERATORS & INDIRECT ── */}
          <SectionBox title="5 · Operators & Indirect Labor">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Operatorów / maszynę" value={operators} set={setOperators} unit="FTE" step="0.1" note="np. 0.5 = współdzielony" />
              <Field label="Indirect labor factor" value={indirectFactor} set={setIndirectFactor} unit="0–1" step="0.01" note="% kosztu direct" />
            </div>
            <div className="bg-slate-900/60 rounded p-2 space-y-1">
              <ResultRow label="Direct labor / h" value={(laborRateCalc * n(operators)).toFixed(2)} unit={`${cur}/h`} />
              <ResultRow label="Indirect add-on" value={`+${(n(indirectFactor) * 100).toFixed(0)}%`} />
              <ResultRow label="= Total labor cost / h" value={(laborRateCalc * n(operators) * (1 + n(indirectFactor))).toFixed(2)} unit={`${cur}/h`} highlight />
            </div>
          </SectionBox>

          {/* ── APPLY ── */}
          <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Zastosuj do RFQ</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {([
                { key: 'energy',    val: applyEnergy,    set: setApplyEnergy,    label: 'Energy Price',           result: `${energyPriceCalc.toFixed(4)} ${cur}/kWh` },
                { key: 'consump',   val: applyConsump,   set: setApplyConsump,   label: 'Machine Consumption',    result: `${machineConsumptionCalc.toFixed(1)} kWh/h` },
                { key: 'aux',       val: applyAux,       set: setApplyAux,       label: 'Auxiliary Equipment',    result: `${auxiliaryCalc.toFixed(1)} kWh/h` },
                { key: 'labor',     val: applyLabor,     set: setApplyLabor,     label: 'Labor Rate',             result: `${laborRateCalc.toFixed(2)} ${cur}/h` },
                { key: 'operators', val: applyOperators, set: setApplyOperators, label: 'Operators / Machine',    result: `${operators} FTE` },
                { key: 'indirect',  val: applyIndirect,  set: setApplyIndirect,  label: 'Indirect Labor Factor',  result: `${(n(indirectFactor) * 100).toFixed(0)}%` },
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
              disabled={!applyEnergy && !applyConsump && !applyAux && !applyLabor && !applyOperators && !applyIndirect}
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
