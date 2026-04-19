import React, { useRef } from 'react';
import { RfqProvider, useRfq } from './context/RfqContext';
import { fmtPrice } from './utils/formatters';
import { exportJson, importJson } from './utils/storage';
import { Dashboard } from './components/tabs/Dashboard';
import { RfqInput } from './components/tabs/RfqInput';
import { CostModel } from './components/tabs/CostModel';
import { PriceStrategy } from './components/tabs/PriceStrategy';
import { Competitiveness } from './components/tabs/Competitiveness';
import { NegotiationSupport } from './components/tabs/NegotiationSupport';
import { Scenarios } from './components/tabs/Scenarios';
import { Sensitivity } from './components/tabs/Sensitivity';
import { Financials } from './components/tabs/Financials';
import type { TabId } from './types/rfq';

const TABS: { id: TabId; label: string; short: string }[] = [
  { id: 'dashboard', label: 'Dashboard', short: '1' },
  { id: 'rfqInput', label: 'RFQ Input', short: '2' },
  { id: 'costModel', label: 'Cost Model', short: '3' },
  { id: 'priceStrategy', label: 'Price Strategy', short: '4' },
  { id: 'competitiveness', label: 'Competitiveness', short: '5' },
  { id: 'negotiation', label: 'Negotiation', short: '6' },
  { id: 'scenarios', label: 'Scenarios', short: '7' },
  { id: 'sensitivity', label: 'Sensitivity', short: '8' },
  { id: 'financials',  label: 'Financials',  short: '9' },
];

function TabContent({ active }: { active: TabId }) {
  switch (active) {
    case 'dashboard': return <Dashboard />;
    case 'rfqInput': return <RfqInput />;
    case 'costModel': return <CostModel />;
    case 'priceStrategy': return <PriceStrategy />;
    case 'competitiveness': return <Competitiveness />;
    case 'negotiation': return <NegotiationSupport />;
    case 'scenarios': return <Scenarios />;
    case 'sensitivity': return <Sensitivity />;
    case 'financials':  return <Financials />;
  }
}

function AppShell() {
  const { state, dispatch, computed } = useRfq();
  const active = state.activeTab;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inp = state.input;
  const cm = computed.costModel;
  const ps = computed.priceStrategy;

  function handleSave() {
    exportJson(state);
  }

  function handleOpen() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importJson(file);
      dispatch({ type: 'LOAD_STATE', payload: data });
    } catch {
      alert('Nie można otworzyć pliku. Upewnij się, że to prawidłowy plik wyceny (.json).');
    }
    e.target.value = '';
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between gap-4 flex-wrap print:hidden">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 text-white font-bold text-sm px-2 py-1 rounded">RFQ</div>
          <div>
            <div className="text-sm font-semibold text-slate-100">Injection Molding Quoting Tool</div>
            <div className="text-xs text-slate-400">{inp.customerName} · {inp.partNumber}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={handleSave}
            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 border border-emerald-600 text-white text-xs rounded font-medium transition-colors"
          >
            ↓ Zapisz wycenę
          </button>
          <button
            onClick={handleOpen}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 text-xs rounded font-medium transition-colors"
          >
            ↑ Otwórz wycenę
          </button>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Cost:</span>
            <span className="text-blue-300 font-bold">{fmtPrice(cm.totalMfgCost)} {inp.currency}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Target:</span>
            <span className="text-green-300 font-bold">{ps.target.price.toFixed(4)} {inp.currency}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">Margin:</span>
            <span className={`font-bold ${ps.target.margin > 0.15 ? 'text-green-300' : ps.target.margin > 0.08 ? 'text-yellow-300' : 'text-red-300'}`}>
              {(ps.target.margin * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="bg-slate-900/80 border-b border-slate-800 px-2 print:hidden">
        <div className="flex overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => dispatch({ type: 'SET_TAB', payload: tab.id })}
              className={`
                flex-shrink-0 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap
                ${active === tab.id
                  ? 'border-blue-500 text-blue-400 bg-blue-900/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }
              `}
            >
              <span className="text-slate-500 mr-1">{tab.short}.</span>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6 max-w-screen-2xl mx-auto w-full">
        <TabContent active={active} />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/50 border-t border-slate-800 px-4 py-2 text-xs text-slate-500 flex justify-between print:hidden">
        <span>RFQ Quoting Tool v2.0 · Injection Molding</span>
        <span>{inp.quotingEngineer} · {inp.rfqDate}</span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <RfqProvider>
      <AppShell />
    </RfqProvider>
  );
}
