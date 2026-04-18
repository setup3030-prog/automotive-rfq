import React, { createContext, useContext, useReducer, useEffect, useMemo } from 'react';
import type { RfqState, RfqInput, PriceStrategyMargins, CompetitivenessInput, ScenariosInput, NegotiationChecklist, TabId, YearPnL, YearWC, YearCF, NpvResult, FinancialRiskScenario, FxExposureResult } from '../types/rfq';
import { calcCostModel } from '../calculations/costModel';
import { calcPriceStrategy } from '../calculations/priceStrategy';
import { calcCompetitiveness } from '../calculations/competitiveness';
import { calcScenarios } from '../calculations/scenarios';
import { calcSensitivity } from '../calculations/sensitivity';
import { calcProgramPnL } from '../calculations/programPnL';
import { calcWorkingCapital } from '../calculations/workingCapital';
import { calcCashflow } from '../calculations/cashflow';
import { calcNpv } from '../calculations/npv';
import { calcFinancialRisk } from '../calculations/financialRisk';
import { calcFxExposure } from '../calculations/fxExposure';
import type { CostModelResult, PriceStrategyResult, CompetitivenessResult, ScenarioResult, SensitivityResult } from '../types/rfq';
import { saveToStorage, loadFromStorage } from '../utils/storage';
import { DEFAULT_THRESHOLDS, type FinancialThresholds } from '../config/financialThresholds';

// ─── Default Values ───────────────────────────────────────────────────────────

const _sopDefault = (() => {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().slice(0, 10);
})();

const DEFAULT_INPUT: RfqInput = {
  currency: 'PLN',
  eurPlnRate: 4.28,
  customerName: 'Volkswagen AG',
  projectName: 'Door Handle Bracket',
  partNumber: 'VW-2024-DHB-001',
  partDescription: 'PP+GF30 Bracket',
  materialGrade: 'PP+GF30',
  rfqDate: '2024-11-01',
  quoteDeadline: '2024-11-22',
  quotingEngineer: 'J. Kowalski',
  volLow: 80000,
  volMid: 200000,
  volPeak: 350000,
  volLifetime: 1200000,
  contractDuration: 5,
  sop: '2025-Q3',
  targetPrice: 1.85,
  paymentTerms: 60,
  incoterms: 'DAP',
  deliveryCountry: 'Germany',
  packagingType: 'KLT 4147',
  partsPerBox: 240,
  packagingCost: 0.038,
  logisticsCost: 0.025,
  customsDuty: 0,
  cycleTimeActual: 28,
  cycleTimeOptimized: 28,
  cavities: 4,
  machineSize: 250,
  machineHourlyRate: 185,
  oee: 0.82,
  scrapRate: 0.035,
  workingHoursYear: 1720,
  shotWeight: 0.085,
  runnerWeight: 0.008,
  materialPrice: 12,
  virginRegrindRatio: 1.0,
  machineConsumption: 45,
  auxiliaryEquipment: 15,
  energyPrice: 0.72,
  laborRate: 42,
  operatorsPerMachine: 1,
  indirectLaborFactor: 0.35,
  toolCost: 320000,
  toolLifetime: 1000000,
  toolOwnership: 1,
  toolMaintenanceYear: 0.03,
  fixedOverhead: 85000,
  variableOverheadRate: 0.12,

  // Financial Analysis
  lifecycleYears: 5,
  volumeCurve: [60, 100, 100, 90, 70],
  sopDateIso: _sopDefault,
  dpoDays: 45,
  dioDays: 30,
  wacc: 0.09,
  toolOwnershipType: 'customer_amortized',
  toolDepreciationYears: 5,
  bankGuaranteePct: 0.008,
  warrantyReservePct: 0.005,
  ldCapPct: 0.05,
  fxEurShareCost: 0.4,
  fxEurShareRevenue: 1.0,
  fxHedgeRatio: 0.6,
  fxEurPln: 4.30,
  escalationMaterial: true,
  escalationMaterialLagQuarters: 1,
  escalationEnergy: false,
  escalationLaborCpi: true,
  customerRating: 'A',
  customerInsuredPct: 0.8,
  corporateOverheadAllocationPct: 0.03,
  ebitdaAssetBase: 0,
};

const DEFAULT_MARGINS: PriceStrategyMargins = {
  marginMin: 0.05,        // walk-away floor
  marginAggressive: 0.09, // competitive bid
  marginTarget: 0.15,     // opening anchor
};

const DEFAULT_COMPETITIVENESS: CompetitivenessInput = {
  competitorPriceLow: 1.55,
  competitorPriceHigh: 2.20,
  competitorEurRate: 0.42,
};

const DEFAULT_SCENARIOS: ScenariosInput = {
  best: { volume: 400000, cycleTime: 28, oee: 0.88, scrapRate: 0.02, materialPrice: 8, machineRate: 175, laborRate: 38, energyPrice: 0.60, fixedOverhead: 75000 },
  realistic: { volume: 200000, cycleTime: 32, oee: 0.82, scrapRate: 0.035, materialPrice: 8.8, machineRate: 185, laborRate: 42, energyPrice: 0.72, fixedOverhead: 85000 },
  worst: { volume: 100000, cycleTime: 42, oee: 0.70, scrapRate: 0.07, materialPrice: 11.5, machineRate: 210, laborRate: 52, energyPrice: 0.98, fixedOverhead: 110000 },
};

const DEFAULT_CHECKLIST: NegotiationChecklist = {
  volumeCommitment: false,
  toolingOwnership: false,
  sopDate: false,
  materialIndex: false,
  energySurcharge: false,
  packagingSpec: false,
  paymentTerms: false,
  qualityRequirements: false,
  productivityTarget: false,
  contractDuration: false,
  toolingTransferRisk: false,
  competitorLikeForLike: false,
};

const DEFAULT_STATE: RfqState = {
  input: DEFAULT_INPUT,
  priceMargins: DEFAULT_MARGINS,
  competitiveness: DEFAULT_COMPETITIVENESS,
  scenarios: DEFAULT_SCENARIOS,
  checklist: DEFAULT_CHECKLIST,
  activeTab: 'dashboard',
  financialThresholds: { ...DEFAULT_THRESHOLDS },
};

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_INPUT'; payload: Partial<RfqInput> }
  | { type: 'SET_MARGINS'; payload: Partial<PriceStrategyMargins> }
  | { type: 'SET_COMPETITIVENESS'; payload: Partial<CompetitivenessInput> }
  | { type: 'SET_SCENARIO'; payload: { scenario: 'best' | 'realistic' | 'worst'; data: Partial<ScenariosInput['best']> } }
  | { type: 'SET_CHECKLIST'; payload: Partial<NegotiationChecklist> }
  | { type: 'SET_TAB'; payload: TabId }
  | { type: 'SET_FINANCIAL_THRESHOLDS'; payload: FinancialThresholds }
  | { type: 'LOAD_STATE'; payload: Partial<RfqState> }
  | { type: 'RESET' };

function reducer(state: RfqState, action: Action): RfqState {
  switch (action.type) {
    case 'SET_INPUT':
      return { ...state, input: { ...state.input, ...action.payload } };
    case 'SET_MARGINS':
      return { ...state, priceMargins: { ...state.priceMargins, ...action.payload } };
    case 'SET_COMPETITIVENESS':
      return { ...state, competitiveness: { ...state.competitiveness, ...action.payload } };
    case 'SET_SCENARIO':
      return {
        ...state,
        scenarios: {
          ...state.scenarios,
          [action.payload.scenario]: { ...state.scenarios[action.payload.scenario], ...action.payload.data },
        },
      };
    case 'SET_CHECKLIST':
      return { ...state, checklist: { ...state.checklist, ...action.payload } };
    case 'SET_FINANCIAL_THRESHOLDS':
      return { ...state, financialThresholds: { ...action.payload } };
    case 'SET_TAB':
      return { ...state, activeTab: action.payload };
    case 'LOAD_STATE':
      return {
        ...DEFAULT_STATE,
        ...action.payload,
        input: { ...DEFAULT_INPUT, ...(action.payload.input ?? {}) },
        priceMargins: { ...DEFAULT_MARGINS, ...(action.payload.priceMargins ?? {}) },
        competitiveness: { ...DEFAULT_COMPETITIVENESS, ...(action.payload.competitiveness ?? {}) },
        scenarios: {
          best: { ...DEFAULT_SCENARIOS.best, ...(action.payload.scenarios?.best ?? {}) },
          realistic: { ...DEFAULT_SCENARIOS.realistic, ...(action.payload.scenarios?.realistic ?? {}) },
          worst: { ...DEFAULT_SCENARIOS.worst, ...(action.payload.scenarios?.worst ?? {}) },
        },
        checklist: { ...DEFAULT_CHECKLIST, ...(action.payload.checklist ?? {}) },
        financialThresholds: { ...DEFAULT_THRESHOLDS, ...(action.payload.financialThresholds ?? {}) },
      };
    case 'RESET':
      return DEFAULT_STATE;
    default:
      return state;
  }
}

// ─── Computed Results ─────────────────────────────────────────────────────────

interface ComputedResults {
  costModel: CostModelResult;
  priceStrategy: PriceStrategyResult;
  competitiveness: CompetitivenessResult;
  scenarios: ScenarioResult[];
  sensitivity: SensitivityResult;
  programPnL: YearPnL[];
  workingCapital: YearWC[];
  cashflow: YearCF[];
  npv: NpvResult;
  financialRisk: FinancialRiskScenario[];
  fxExposure: FxExposureResult;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface RfqContextValue {
  state: RfqState;
  computed: ComputedResults;
  dispatch: React.Dispatch<Action>;
}

const RfqContext = createContext<RfqContextValue | null>(null);

export function RfqProvider({ children }: { children: React.ReactNode }) {
  const saved = loadFromStorage();
  const initialState = saved
    ? reducer(DEFAULT_STATE, { type: 'LOAD_STATE', payload: saved })
    : DEFAULT_STATE;

  const [state, dispatch] = useReducer(reducer, initialState);

  // Persist to localStorage on every change
  useEffect(() => {
    saveToStorage(state);
  }, [state]);

  // Recompute everything reactively
  const computed = useMemo<ComputedResults>(() => {
    const costModel = calcCostModel(state.input);
    const priceStrategy = calcPriceStrategy(state.input, costModel, state.priceMargins);
    const competitiveness = calcCompetitiveness(state.input, state.competitiveness, priceStrategy);
    const scenarios = calcScenarios(state.input, state.scenarios, state.priceMargins);
    const sensitivity = calcSensitivity(state.input);
    const programPnL = calcProgramPnL(state.input, costModel, priceStrategy);
    const workingCapital = calcWorkingCapital(programPnL, state.input);
    const cashflow = calcCashflow(programPnL, workingCapital, state.input);
    const npv = calcNpv(cashflow, programPnL, workingCapital, state.input, state.financialThresholds.hurdleIrr);
    const financialRisk = calcFinancialRisk(state.input, costModel, priceStrategy, state.financialThresholds.hurdleIrr);
    const fxExposure = calcFxExposure(programPnL, state.input);
    return { costModel, priceStrategy, competitiveness, scenarios, sensitivity, programPnL, workingCapital, cashflow, npv, financialRisk, fxExposure };
  }, [state.input, state.priceMargins, state.competitiveness, state.scenarios]);

  return (
    <RfqContext.Provider value={{ state, computed, dispatch }}>
      {children}
    </RfqContext.Provider>
  );
}

export function useRfq(): RfqContextValue {
  const ctx = useContext(RfqContext);
  if (!ctx) throw new Error('useRfq must be used inside RfqProvider');
  return ctx;
}
