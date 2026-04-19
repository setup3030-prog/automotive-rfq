export interface CountryEstimate {
  country: string;
  code: string;
  machine_rate_eur: number;
  labor_rate_eur: number;
  energy_rate_eur: number;
  est_cost_eur: number;
  est_price_low_eur: number;
  est_price_high_eur: number;
  rationale: string;
}

export interface CompetitorAnalysisResponse {
  countries: CountryEstimate[];
  summary: string;
}

export declare const calculateRFQ: (data: unknown) => Promise<unknown>;
export declare const saveQuote: (data: unknown) => Promise<unknown>;
export declare const listQuotes: () => Promise<unknown>;
export declare const getQuote: (id: number | string) => Promise<unknown>;
export declare const analyzeCompetitors: (data: unknown) => Promise<CompetitorAnalysisResponse>;
export declare function exportPDF(data: unknown): Promise<Blob>;
export declare function exportWord(data: unknown): Promise<Blob>;
export declare function exportCfoPDF(data: unknown): Promise<Blob>;
