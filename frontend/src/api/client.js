const API_BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err.detail) {
        if (Array.isArray(err.detail)) {
          // Pydantic validation errors: [{loc, msg, type}, ...]
          detail = err.detail.map((e) => `${e.loc?.slice(1).join('.')}: ${e.msg}`).join('; ');
        } else {
          detail = String(err.detail);
        }
      }
    } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}

export const calculateRFQ = (data) =>
  request('/api/v1/rfq/calculate', { method: 'POST', body: JSON.stringify(data) });

export const saveQuote = (data) =>
  request('/api/v1/quotes/', { method: 'POST', body: JSON.stringify(data) });

export const listQuotes = () => request('/api/v1/quotes/');

export const getQuote = (id) => request(`/api/v1/quotes/${id}`);

/**
 * AI competitor price analysis — returns CompetitorAnalysisResponse JSON.
 */
export const analyzeCompetitors = (data) =>
  request('/api/v1/rfq/competitor-analysis', { method: 'POST', body: JSON.stringify(data) });

/**
 * Export PDF quote — returns a Blob (binary PDF).
 * Usage: const blob = await exportPDF(data); triggerDownload(blob, 'quote.pdf');
 */
export async function exportPDF(data) {
  const url = `${API_BASE}/api/v1/rfq/export-pdf`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err.detail) detail = String(err.detail);
    } catch (_) {}
    throw new Error(detail);
  }
  return res.blob();
}
