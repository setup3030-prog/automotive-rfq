// Number formatting utilities (European style: space as thousands separator)

export function fmtNum(value: number, decimals = 0): string {
  if (!isFinite(value) || isNaN(value)) return '—';
  const parts = value.toFixed(decimals).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return parts.join(',');
}

export function fmtPrice(value: number, decimals = 4): string {
  return fmtNum(value, decimals);
}

export function fmtPct(value: number, decimals = 1): string {
  if (!isFinite(value) || isNaN(value)) return '—';
  return (value * 100).toFixed(decimals) + '%';
}

export function fmtCurrency(value: number, currency: string, decimals = 2): string {
  return `${fmtNum(value, decimals)} ${currency}`;
}

export function fmtVol(value: number): string {
  return fmtNum(value, 0);
}

export function safe(value: number): number {
  if (!isFinite(value) || isNaN(value)) return 0;
  return value;
}

export function safeDiv(num: number, den: number): number {
  if (den === 0 || !isFinite(den) || isNaN(den)) return 0;
  return safe(num / den);
}
