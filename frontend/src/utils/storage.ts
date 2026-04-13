import type { RfqState } from '../types/rfq';

const STORAGE_KEY = 'rfq-quoting-tool-v2';

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
