import React, { useState, useEffect } from 'react';
import { useRfq } from '../../context/RfqContext';
import { loadSnapshots, saveSnapshot, deleteSnapshot } from '../../utils/storage';
import type { QuoteSnapshot } from '../../utils/storage';
import { fmtPrice, fmtPct } from '../../utils/formatters';

interface Props { onClose: () => void; }

export function QuoteHistory({ onClose }: Props) {
  const { state, dispatch, computed } = useRfq();
  const [snaps, setSnaps] = useState<QuoteSnapshot[]>([]);
  const [saveName, setSaveName] = useState(
    `${state.input.partNumber || 'Quote'} — ${new Date().toLocaleDateString('pl-PL')}`
  );
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => { setSnaps(loadSnapshots()); }, []);

  function handleSave() {
    const name = saveName.trim() || 'Unnamed';
    saveSnapshot(
      state,
      name,
      computed.priceStrategy.target.price,
      computed.priceStrategy.target.margin,
      computed.costModel.totalMfgCost,
    );
    setSnaps(loadSnapshots());
    setSaveName('');
  }

  function handleLoad(snap: QuoteSnapshot) {
    dispatch({ type: 'LOAD_STATE', payload: snap.state });
    onClose();
  }

  function handleDelete(id: string) {
    deleteSnapshot(id);
    setSnaps(loadSnapshots());
    setConfirmDelete(null);
  }

  const cur = state.input.currency;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Quote History</h2>
            <p className="text-xs text-slate-400 mt-0.5">Maks. 10 zapisanych wycen · ładuje się bez utraty aktualnej</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg font-bold leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Save current */}
          <div className="bg-slate-800/60 rounded-lg p-4">
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">Zapisz aktualną wycenę</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder="Nazwa wyceny..."
                className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded transition-colors whitespace-nowrap"
              >
                Zapisz
              </button>
            </div>
            {/* Current summary */}
            <div className="mt-2 flex gap-4 text-xs text-slate-500 font-mono">
              <span>Koszt: <span className="text-blue-300">{fmtPrice(computed.costModel.totalMfgCost)} {cur}</span></span>
              <span>Target: <span className="text-green-300">{fmtPrice(computed.priceStrategy.target.price)} {cur}</span></span>
              <span>Marża: <span className="text-green-300">{fmtPct(computed.priceStrategy.target.margin)}</span></span>
            </div>
          </div>

          {/* Snapshot list */}
          {snaps.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-8">Brak zapisanych wycen</div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{snaps.length} / 10 zapisanych</p>
              {snaps.map(snap => (
                <div key={snap.id} className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-200 truncate">{snap.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {new Date(snap.savedAt).toLocaleString('pl-PL')} · {snap.summary.customer} · {snap.summary.partNumber}
                    </div>
                    <div className="flex gap-3 mt-1 text-xs font-mono">
                      <span className="text-slate-400">Koszt: <span className="text-blue-300">{fmtPrice(snap.summary.cost)} {snap.summary.currency}</span></span>
                      <span className="text-slate-400">Target: <span className="text-green-300">{fmtPrice(snap.summary.targetPrice)} {snap.summary.currency}</span></span>
                      <span className="text-slate-400">Marża: <span className={snap.summary.margin > 0.15 ? 'text-green-300' : snap.summary.margin > 0.08 ? 'text-yellow-300' : 'text-red-300'}>{fmtPct(snap.summary.margin)}</span></span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleLoad(snap)}
                      className="px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded font-medium transition-colors"
                    >
                      Załaduj
                    </button>
                    {confirmDelete === snap.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleDelete(snap.id)}
                          className="px-2 py-1 bg-red-700 hover:bg-red-600 text-white text-xs rounded font-medium">
                          Tak
                        </button>
                        <button onClick={() => setConfirmDelete(null)}
                          className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded font-medium">
                          Nie
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(snap.id)}
                        className="px-2 py-1 bg-slate-700 hover:bg-red-900/50 text-slate-400 hover:text-red-300 text-xs rounded font-medium transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
