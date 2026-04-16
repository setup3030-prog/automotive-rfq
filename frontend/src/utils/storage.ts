import type { RfqState } from '../types/rfq';

const STORAGE_KEY = 'rfq-quoting-tool-v2';
const HISTORY_KEY = 'rfq-quote-history-v1';
const MAX_SNAPSHOTS = 10;

export interface QuoteSnapshot {
  id: string;
  name: string;
  savedAt: string;
  state: RfqState;
  summary: { cost: number; targetPrice: number; margin: number; partNumber: string; customer: string; currency: string; };
}

export function loadSnapshots(): QuoteSnapshot[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as QuoteSnapshot[]) : [];
  } catch { return []; }
}

export function saveSnapshot(state: RfqState, name: string, targetPrice: number, margin: number, cost: number): void {
  try {
    const snaps = loadSnapshots();
    const snap: QuoteSnapshot = {
      id: Date.now().toString(),
      name,
      savedAt: new Date().toISOString(),
      state,
      summary: { cost, targetPrice, margin, partNumber: state.input.partNumber, customer: state.input.customerName, currency: state.input.currency },
    };
    const updated = [snap, ...snaps].slice(0, MAX_SNAPSHOTS);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch { console.warn('Failed to save snapshot'); }
}

export function deleteSnapshot(id: string): void {
  try {
    const snaps = loadSnapshots().filter(s => s.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(snaps));
  } catch { /* ignore */ }
}

export function saveToStorage(state: RfqState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    console.warn('Failed to save to localStorage');
  }
}

export function loadFromStorage(): Partial<RfqState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<RfqState>;
  } catch {
    return null;
  }
}

export function exportJson(state: RfqState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rfq-${state.input.partNumber || 'export'}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importJson(file: File): Promise<Partial<RfqState>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as Partial<RfqState>;
        resolve(data);
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
