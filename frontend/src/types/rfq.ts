// ─── RFQ Input State ─────────────────────────────────────────────────────────

export interface RfqInput {
  // 2.1 Currency
  currency: 'PLN' | 'EUR' | 'USD';
  eurPlnRate: number;

  // 2.2 Client & Project
  customerName: string;
  projectName: string;
  partNumber: string;
  partDescription: string;
  materialGrade: string;
  rfqDate: string;
  quoteDeadline: string;
  quotingEngineer: string;

  // 2.3 Volume & Commercial
  volLow: number;
  volMid: number;
  volPeak: number;
  volLifetime: number;
  contractDuration: number;
  sop: string;
  targetPrice: number; // customer target price
  paymentTerms: number;

  // 2.4 Logistics & Packaging
  incoterms: 'EXW' | 'FCA' | 'DAP' | 'DDP';
  deliveryCountry: string;
  packagingType: string;
  partsPerBox: number;
  packagingCost: number;
  logisticsCost: number;
  customsDuty: number;

  // 2.5 Machine & Process
  cycleTimeActual: number;
  cycleTimeOptimized: number;
  cavities: number;
  machineSize: number;
  machineHourlyRate: number;
  oee: number;
  scrapRate: number;
  workingHoursYear: number;

  // 2.6 Material
  shotWeight: number;
  runnerWeight: number;
  materialPrice: number;
  virginRegrindRatio: number;

  // 2.7 Energy & Labor
  machineConsumption: number;
  auxiliaryEquipment: number;
  energyPrice: number;
  laborRate: number;
  operatorsPerMachine: number;
  indirectLaborFactor: number;

  // 2.8 Tooling
  toolCost: number;
  toolLifetime: number;
  toolOwnership: 0 | 1;
  toolMaintenanceYear: number;

  // 2.9 Overhead
  fixedOverhead: number;
  variableOverheadRate: number;

  // 2.10 Financial Analysis (CFO section)
  lifecycleYears: number;
  volumeCurve: number[];              // length = lifecycleYears; % of annual base volume
  sopDateIso: string;                 // ISO date, start of production
  dpoDays: number;                    // payables days outstanding
  dioDays: number;                    // inventory days outstanding
  wacc: number;                       // fraction 0–1
  hurdleRate: number;                 // fraction 0–1
  toolOwnershipType: 'customer_paid' | 'customer_amortized' | 'supplier';
  toolDepreciationYears: number;
  bankGuaranteePct: number;           // fraction p.a. of tool value
  warrantyReservePct: number;         // fraction of revenue
  ldCapPct: number;                   // LD cap fraction of contract value
  fxEurShareCost: number;             // fraction of costs denominated in EUR
  fxEurShareRevenue: number;          // fraction of revenue denominated in EUR
  fxHedgeRatio: number;               // fraction 0–1
  fxEurPln: number;                   // reference EUR/PLN rate
  escalationMaterial: boolean;
  escalationMaterialLagQuarters: number;
  escalationEnergy: boolean;
  escalationLaborCpi: boolean;
  customerRating: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'UNRATED';
  customerInsuredPct: number;         // fraction 0–1
  corporateOverheadAllocationPct: number; // fraction of revenue
  ebitdaAssetBase: number;            // PLN — production assets allocated to this program
}

// ─── Price Strategy Margins ───────────────────────────────────────────────────

export interface PriceStrategyMargins {
  marginMin: number;      // Walk Away
  marginTarget: number;   // Target
  marginAggressive: number; // Aggressive
}

// ─── Competitiveness Inputs ───────────────────────────────────────────────────

export interface CompetitivenessInput {
  competitorPriceLow: number;
  competitorPriceHigh: number;
  competitorEurRate: number;
}

// ─── Scenario Parameters ──────────────────────────────────────────────────────

export interface ScenarioParams {
  volume: number;
  cycleTime: number;
  oee: number;
  scrapRate: number;
  materialPrice: number;
  machineRate: number;
  laborRate: number;
  energyPrice: number;
  fixedOverhead: number;
}

export interface ScenariosInput {
  best: ScenarioParams;
  realistic: ScenarioParams;
  worst: ScenarioParams;
}

// ─── Negotiation Checklist ────────────────────────────────────────────────────

export interface NegotiationChecklist {
  volumeCommitment: boolean;
  toolingOwnership: boolean;
  sopDate: boolean;
  materialIndex: boolean;
  energySurcharge: boolean;
  packagingSpec: boolean;
  paymentTerms: boolean;
  qualityRequirements: boolean;
  productivityTarget: boolean;
  contractDuration: boolean;
  toolingTransferRisk: boolean;
  competitorLikeForLike: boolean;
}

// ─── Full App State ───────────────────────────────────────────────────────────

export interface RfqState {
  input: RfqInput;
  priceMargins: PriceStrategyMargins;
  competitiveness: CompetitivenessInput;
  scenarios: ScenariosInput;
  checklist: NegotiationChecklist;
  activeTab: TabId;
}

export type TabId =
  | 'dashboard'
  | 'rfqInput'
  | 'costModel'
  | 'priceStrategy'
  | 'competitiveness'
  | 'negotiation'
  | 'scenarios'
  | 'sensitivity'
  | 'financials';

// ─── Calculated Results ───────────────────────────────────────────────────────

export interface RealityGuards {
  oeeUsed: number;
  scrapUsed: number;
  oeeWarning: boolean;
  scrapWarning: boolean;
  cycleOptimizedWarning: boolean;
}

export interface MachineCosts {
  partsPerHourGross: number;
  partsPerHourNet: number;
  requiredHoursYear: number;
  machineUtilization: number;
  machineCostPerPart: number;
  setupCostPerPart: number;
  maintenancePerPart: number;
  totalMachineCost: number;
}

export interface MaterialCosts {
  netPartWeight: number;
  runnerPerPart: number;
  grossWeight: number;
  effectiveMatPrice: number;
  grossMaterialCost: number;
  regrindCredit: number;
  scrapCost: number;
  materialWaste: number;
  totalMaterialCost: number;
}

export interface ToolingCosts {
  annualShots: number;
  toolLifeYears: number;
  amortizationPerPart: number;
  maintenancePerPartTool: number;
  financingCostPerPart: number;
  totalToolingCost: number;
}

export interface LaborCosts {
  directLaborPerPart: number;
  indirectLaborPerPart: number;
  totalLaborCost: number;
}

export interface EnergyCosts {
  totalKwh: number;
  energyCostPerPart: number;
  totalEnergyCost: number;
}

export interface OverheadCosts {
  fixedOhPerPart: number;
  variableOhPerPart: number;
  totalOverhead: number;
}

export interface CostModelResult {
  guards: RealityGuards;
  machine: MachineCosts;
  material: MaterialCosts;
  tooling: ToolingCosts;
  labor: LaborCosts;
  energy: EnergyCosts;
  overhead: OverheadCosts;
  totalMfgCost: number;
}

export interface PricePoint {
  price: number;
  margin: number;
  grossMarginPerPart: number;
  vsCustomerTarget: number;
  annualRevenue: number;
  annualProfit: number;
  lifetimeRevenue: number;
  breakEvenVolume: number;
  risk: string;
  goNoGo: string;
  financingCost: number;
}

export interface PriceStrategyResult {
  walkAway: PricePoint;
  target: PricePoint;
  aggressive: PricePoint;
}

export interface CompetitivenessResult {
  competitorMid: number;
  gapTargetVsCompMid: number;
  gapAggressiveVsCompLow: number;
  maxDiscount: number;
  maxDiscountPct: number;
  competitiveStatus: string;
  ourPriceEur: number;
  locationAdvantage: number;
  annualSavingsVsWEurope: number;
}

export interface ScenarioResult {
  name: string;
  params: ScenarioParams;
  mfgCost: number;
  sellingPrice: number;
  margin: number;
  annualRevenue: number;
  annualProfit: number;
  goNoGo: string;
}

export interface SensitivityPoint {
  param: number;
  cost: number;
  vsBase: number;
  marginAtTarget: number;
  goNoGo: string;
  isBase: boolean;
}

export interface SensitivityResult {
  cycleTime: SensitivityPoint[];
  materialPrice: SensitivityPoint[];
  oee: SensitivityPoint[];
  energyPrice: SensitivityPoint[];
}

// ─── Financial Analysis Results ───────────────────────────────────────────────

export interface YearPnL {
  year: number;              // 1-indexed (Year 1 = first production year)
  volumeUnits: number;
  revenue: number;
  cogsMaterial: number;
  cogsLabor: number;
  cogsMachine: number;
  cogsEnergy: number;
  cogsOverheadDirect: number;
  cogsToolingAmort: number;
  grossProfit: number;
  grossMarginPct: number;
  corporateOverheadAlloc: number;
  ebitda: number;
  depreciation: number;      // tooling NBV depreciation (supplier-owned only)
  ebit: number;
  ebitPct: number;
}

export interface YearWC {
  year: number;
  receivables: number;
  inventory: number;
  payables: number;
  netWC: number;
  deltaWC: number;           // netWC[i] - netWC[i-1]; Year 1 baseline vs 0
}

export interface YearCF {
  year: number;
  ebitda: number;
  taxPaid: number;
  deltaWC: number;
  capex: number;
  operatingCF: number;
  freeCF: number;
  cumulativeFCF: number;
}

export interface NpvResult {
  npv: number;
  irr: number | null;
  paybackMonths: number | null;
  discountedPayback: number | null;
  roceY3: number;
  y3Idx: number;       // 0-based index of the year used for ROCE (min(2, lifecycle-1))
  meetsHurdle: boolean;
}

export interface FinancialRiskScenario {
  name: string;
  deltaNpv: number;
  deltaEbitdaY2: number;
  newIrr: number | null;
  stillMeetsHurdle: boolean;
}

export interface FxExposureResult {
  revenueEur: number;
  costEur: number;
  netOpenEur: number;
  hedgedEur: number;
  unhedgedEur: number;
  marginImpactFxPlus10Pp: number;
  marginImpactFxMinus10Pp: number;
  naturalHedgePct: number;
}
