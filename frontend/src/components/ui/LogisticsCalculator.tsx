import React, { useState, useEffect } from 'react';
import { useRfq } from '../../context/RfqContext';

interface Props {
  onClose: () => void;
}

type TransportMode = 'road_ftl' | 'road_ltl' | 'air' | 'sea';

function n(v: string): number { return parseFloat(v) || 0; }

function Row({ label, value, unit, highlight }: { label: string; value: string; unit?: string; highlight?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-1 ${highlight ? 'text-blue-300 font-semibold' : 'text-slate-400'}`}>
      <span className="text-xs">{label}</span>
      <span className="font-mono text-xs">{value}{unit ? ` ${unit}` : ''}</span>
    </div>
  );
}

export function LogisticsCalculator({ onClose }: Props) {
  const { state, dispatch } = useRfq();
  const inp = state.input;
  const cur = inp.currency;
  const partWeightDefault = inp.shotWeight > 0 && inp.cavities > 0
    ? (inp.shotWeight / inp.cavities)
    : 0.1;

  // ── Packaging ────────────────────────────────────────────────
  const [boxCost, setBoxCost] = useState('2.50');
  const [partsPerBox, setPartsPerBox] = useState(String(inp.partsPerBox || 50));
  const [labelCost, setLabelCost] = useState('0.03');
  const [dunnageCost, setDunnageCost] = useState('0.00');

  // ── Logistics ────────────────────────────────────────────────
  const [mode, setMode] = useState<TransportMode>('road_ftl');
  const [partWeight, setPartWeight] = useState(partWeightDefault.toFixed(4));

  // Road FTL
  const [distanceKm, setDistanceKm] = useState('300');
  const [ratePerKm, setRatePerKm] = useState('6.50');
  const [truckCapacityKg, setTruckCapacityKg] = useState('24000');

  // Road LTL / Air
  const [ratePerKg, setRatePerKg] = useState(mode === 'air' ? '15.00' : '1.20');

  // Reset mode-dependent fields when transport mode changes
  useEffect(() => {
    setRatePerKg(mode === 'air' ? '15.00' : '1.20');
  }, [mode]);

  // Sea
  const [containerCost, setContainerCost] = useState('3500');
  const [containerCapacityKg, setContainerCapacityKg] = useState('26000');

  // ── Packaging Calc ───────────────────────────────────────────
  const pBox = n(boxCost);
  const pParts = n(partsPerBox);
  const pLabel = n(labelCost);
  const pDunnage = n(dunnageCost);
  const packCostPerPart = pParts > 0 ? pBox / pParts + pLabel + pDunnage : 0;

  // ── Logistics Calc ───────────────────────────────────────────
  const pw = n(partWeight);
  const vol = inp.volMid || 1;
  let logCostPerPart = 0;
  let logDetails: { label: string; value: string; unit?: string }[] = [];

  if (mode === 'road_ftl') {
    const dist = n(distanceKm);
    const rate = n(ratePerKm);
    const cap = n(truckCapacityKg);
    const freightPerTrip = dist * rate;
    const partsPerTruck = pw > 0 ? Math.floor(cap / pw) : 0;
    const shipmentsPerYear = partsPerTruck > 0 ? Math.ceil(vol / partsPerTruck) : 0;
    const annualFreight = shipmentsPerYear * freightPerTrip;
    logCostPerPart = vol > 0 ? annualFreight / vol : 0;
    logDetails = [
      { label: 'Freight per trip', value: freightPerTrip.toFixed(0), unit: cur },
      { label: 'Parts per truck', value: partsPerTruck.toLocaleString(), unit: 'pcs' },
      { label: 'Shipments / year', value: shipmentsPerYear.toLocaleString() },
      { label: 'Annual freight', value: annualFreight.toFixed(0), unit: cur },
    ];
  } else if (mode === 'road_ltl' || mode === 'air') {
    const rate = n(ratePerKg);
    logCostPerPart = pw * rate;
    logDetails = [
      { label: 'Rate per kg', value: rate.toFixed(2), unit: `${cur}/kg` },
      { label: 'Part weight', value: pw.toFixed(4), unit: 'kg' },
    ];
  } else if (mode === 'sea') {
    const contCost = n(containerCost);
    const contCap = n(containerCapacityKg);
    const partsPerContainer = pw > 0 ? Math.floor(contCap / pw) : 0;
    logCostPerPart = partsPerContainer > 0 ? contCost / partsPerContainer : 0;
    logDetails = [
      { label: 'Container cost', value: contCost.toFixed(0), unit: cur },
      { label: 'Parts per container', value: partsPerContainer.toLocaleString(), unit: 'pcs' },
    ];
  }

  function handleApply() {
    dispatch({
      type: 'SET_INPUT',
      payload: {
        packagingCost: Math.round(packCostPerPart * 10000) / 10000,
        logisticsCost: Math.round(logCostPerPart * 10000) / 10000,
        partsPerBox: n(partsPerBox),
      },
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Logistics & Packaging Calculator</h2>
            <p className="text-xs text-slate-400 mt-0.5">Wylicza koszt/sztukę — kliknij Apply aby zastosować</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg font-bold leading-none">✕</button>
        </div>

        <div className="p-5 space-y-5">

          {/* ── PACKAGING ── */}
          <div className="bg-slate-800/60 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 border-b border-slate-700 pb-2">
              Packaging
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[
                { label: 'Koszt pudełka/opak.', value: boxCost, set: setBoxCost, unit: cur },
                { label: 'Sztuk w pudle', value: partsPerBox, set: setPartsPerBox, unit: 'pcs' },
                { label: 'Etykieta/sztuka', value: labelCost, set: setLabelCost, unit: cur },
                { label: 'Przekładka (dunnage)', value: dunnageCost, set: setDunnageCost, unit: cur },
              ].map(({ label, value, set, unit }) => (
                <label key={label} className="flex flex-col gap-1">
                  <span className="text-xs text-slate-400">{label}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" step="0.01" min="0"
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-slate-500 w-10 shrink-0">{unit}</span>
                  </div>
                </label>
              ))}
            </div>
            <div className="bg-slate-900/60 rounded p-2 space-y-1">
              <Row label={`Pudełko / sztuka (${boxCost} ÷ ${partsPerBox})`} value={(pBox / Math.max(pParts,1)).toFixed(4)} unit={cur} />
              <Row label="+ etykieta" value={pLabel.toFixed(4)} unit={cur} />
              <Row label="+ przekładka" value={pDunnage.toFixed(4)} unit={cur} />
              <div className="border-t border-slate-700 mt-1 pt-1">
                <Row label="= Packaging cost / part" value={packCostPerPart.toFixed(4)} unit={cur} highlight />
              </div>
            </div>
          </div>

          {/* ── LOGISTICS ── */}
          <div className="bg-slate-800/60 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 border-b border-slate-700 pb-2">
              Logistics
            </h3>

            {/* Mode selector */}
            <div className="flex gap-2 mb-4">
              {([
                ['road_ftl', 'Road FTL'],
                ['road_ltl', 'Road LTL'],
                ['air', 'Air'],
                ['sea', 'Sea'],
              ] as [TransportMode, string][]).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${mode === m ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Part weight — always shown */}
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-400">
                  Waga części (kg)
                  {inp.shotWeight > 0 && (
                    <button
                      onClick={() => setPartWeight(partWeightDefault.toFixed(4))}
                      className="ml-2 text-blue-400 hover:text-blue-300 underline text-[10px]"
                    >
                      z RFQ ({partWeightDefault.toFixed(4)})
                    </button>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  <input type="number" step="0.0001" min="0" value={partWeight} onChange={(e) => setPartWeight(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500" />
                  <span className="text-xs text-slate-500 w-10 shrink-0">kg</span>
                </div>
              </label>

              {mode === 'road_ftl' && (<>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-400">Odległość (km)</span>
                  <div className="flex items-center gap-1">
                    <input type="number" step="10" min="0" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500" />
                    <span className="text-xs text-slate-500 w-10 shrink-0">km</span>
                  </div>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-400">Stawka/km</span>
                  <div className="flex items-center gap-1">
                    <input type="number" step="0.1" min="0" value={ratePerKm} onChange={(e) => setRatePerKm(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500" />
                    <span className="text-xs text-slate-500 w-16 shrink-0">{cur}/km</span>
                  </div>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-400">Ładowność TIR</span>
                  <div className="flex items-center gap-1">
                    <input type="number" step="500" min="0" value={truckCapacityKg} onChange={(e) => setTruckCapacityKg(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500" />
                    <span className="text-xs text-slate-500 w-10 shrink-0">kg</span>
                  </div>
                </label>
              </>)}

              {(mode === 'road_ltl' || mode === 'air') && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-400">Stawka/kg</span>
                  <div className="flex items-center gap-1">
                    <input type="number" step="0.01" min="0" value={ratePerKg} onChange={(e) => setRatePerKg(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500" />
                    <span className="text-xs text-slate-500 w-16 shrink-0">{cur}/kg</span>
                  </div>
                </label>
              )}

              {mode === 'sea' && (<>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-400">Koszt kontenera</span>
                  <div className="flex items-center gap-1">
                    <input type="number" step="100" min="0" value={containerCost} onChange={(e) => setContainerCost(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500" />
                    <span className="text-xs text-slate-500 w-10 shrink-0">{cur}</span>
                  </div>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-400">Pojemność kontenera</span>
                  <div className="flex items-center gap-1">
                    <input type="number" step="500" min="0" value={containerCapacityKg} onChange={(e) => setContainerCapacityKg(e.target.value)}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500" />
                    <span className="text-xs text-slate-500 w-10 shrink-0">kg</span>
                  </div>
                </label>
              </>)}
            </div>

            {/* Results */}
            <div className="bg-slate-900/60 rounded p-2 space-y-1">
              {logDetails.map(d => (
                <Row key={d.label} label={d.label} value={d.value} unit={d.unit} />
              ))}
              <div className="border-t border-slate-700 mt-1 pt-1">
                <Row label="= Logistics cost / part" value={logCostPerPart.toFixed(4)} unit={cur} highlight />
              </div>
            </div>
          </div>

          {/* ── SUMMARY & APPLY ── */}
          <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Podsumowanie</span>
              <span className="text-xs text-slate-400">Wolumen: {(inp.volMid || 0).toLocaleString()} szt/rok</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-slate-800/60 rounded p-3 text-center">
                <div className="text-xs text-slate-400 mb-1">Packaging/part</div>
                <div className="font-mono text-blue-300 font-bold">{packCostPerPart.toFixed(4)} {cur}</div>
              </div>
              <div className="bg-slate-800/60 rounded p-3 text-center">
                <div className="text-xs text-slate-400 mb-1">Logistics/part</div>
                <div className="font-mono text-blue-300 font-bold">{logCostPerPart.toFixed(4)} {cur}</div>
              </div>
              <div className="bg-slate-800/60 rounded p-3 text-center">
                <div className="text-xs text-slate-400 mb-1">Razem/part</div>
                <div className="font-mono text-green-300 font-bold">{(packCostPerPart + logCostPerPart).toFixed(4)} {cur}</div>
              </div>
            </div>
            <button
              onClick={handleApply}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Apply to RFQ
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
