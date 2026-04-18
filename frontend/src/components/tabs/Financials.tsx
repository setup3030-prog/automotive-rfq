import React, { useState } from 'react';
import { exportCfoPDF } from '../../api/client';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { useRfq } from '../../context/RfqContext';
import { KpiCard } from '../ui/KpiCard';
import { SectionHeader } from '../ui/SectionHeader';
import { fmtNum, fmtPct, fmtPrice } from '../../utils/formatters';
import { peakNetWC } from '../../calculations/workingCapital';
import {
  flagIrr, flagPayback, flagRoce, flagGm, flagNpv, flagWcIntensity,
  type FinancialThresholds, type TrafficLight,
} from '../../config/financialThresholds';

type SubTab = 'overview' | 'pnl' | 'cashwc' | 'capex' | 'riskfx' | 'commercial';
const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'overview',    label: '1. Overview' },
  { id: 'pnl',        label: '2. P&L' },
  { id: 'cashwc',     label: '3. Cash & WC' },
  { id: 'capex',      label: '4. CAPEX & Tooling' },
  { id: 'riskfx',     label: '5. Risk & FX' },
  { id: 'commercial', label: '6. Commercial' },
];

function tlToHighlight(tl: TrafficLight): 'green' | 'yellow' | 'red' {
  return tl;
}

const M = (v: number) => `${(v / 1_000_000).toFixed(2)}M`;
const K = (v: number) => v >= 1_000_000 ? M(v) : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v));

// ─── Overview ─────────────────────────────────────────────────────────────────
function OverviewTab({ thresholds, onEditThresholds }: { thresholds: FinancialThresholds; onEditThresholds: () => void }) {
  const { computed, state } = useRfq();
  const { npv, cashflow, workingCapital, programPnL, financialRisk, fxExposure: fx } = computed;
  const inp = state.input;
  const cur = inp.currency;

  const peakWC = peakNetWC(workingCapital);
  const peakRevenue = Math.max(...programPnL.map(y => y.revenue), 1);
  const avgGmY13 = programPnL.slice(0, 3).reduce((s, y) => s + y.grossMarginPct, 0) / Math.min(3, programPnL.length);
  const totalEbitda = cashflow.reduce((s, y) => s + y.ebitda, 0);
  const toolingExposure = inp.toolOwnershipType === 'supplier' ? inp.toolCost : inp.toolOwnershipType === 'customer_amortized' ? inp.toolCost * 0.5 : 0;

  const top3Risks = financialRisk.slice(0, 3);

  const [cfoPdfLoading, setCfoPdfLoading] = useState(false);
  const [cfoPdfError, setCfoPdfError] = useState<string | null>(null);

  const handleExportCfoPDF = async () => {
    setCfoPdfLoading(true);
    setCfoPdfError(null);
    try {
      const payload = {
        program: inp.projectName || 'New RFQ',
        customer: inp.customerName || null,
        quoting_engineer: inp.quotingEngineer || null,
        rfq_date: inp.rfqDate || new Date().toISOString().slice(0, 10),
        currency: cur,
        npv_str: `${K(npv.npv)} ${cur}`,
        irr_str: npv.irr !== null ? fmtPct(npv.irr) : 'N/A',
        payback_str: npv.paybackMonths !== null ? `${npv.paybackMonths.toFixed(0)} mo` : 'N/A',
        roce_str: fmtPct(npv.roceY3),
        peak_wc_str: `${K(peakWC)} ${cur}`,
        tooling_str: `${K(toolingExposure)} ${cur}`,
        npv_flag: flagNpv(npv.npv),
        irr_flag: flagIrr(npv.irr, thresholds),
        payback_flag: flagPayback(npv.paybackMonths, thresholds),
        roce_flag: flagRoce(npv.roceY3, thresholds),
        wc_flag: flagWcIntensity(peakWC, peakRevenue, thresholds),
        meets_hurdle: npv.meetsHurdle,
        pnl_years: programPnL.map(y => ({
          year: `Y${y.year}`,
          revenue: `${K(y.revenue)} ${cur}`,
          gm_pct: fmtPct(y.grossMarginPct),
          ebitda: `${K(y.ebitda)} ${cur}`,
        })),
        top_risks: financialRisk.slice(0, 5).map(r => ({
          name: r.name,
          delta_npv_str: `${r.deltaNpv >= 0 ? '+' : ''}${K(r.deltaNpv)} ${cur}`,
          status: r.stillMeetsHurdle ? 'GO' : 'NO GO',
          still_meets_hurdle: r.stillMeetsHurdle,
        })),
        fx_summary: {
          net_open_str: `${fmtNum(fx.netOpenEur, 0)} EUR`,
          natural_hedge_str: fmtPct(fx.naturalHedgePct / 100),
          hedge_ratio_str: fmtPct(inp.fxHedgeRatio),
          margin_plus_str: `+${fx.marginImpactFxPlus10Pp.toFixed(2)} pp`,
        },
        conditions: [
          ...(npv.meetsHurdle ? [] : [`IRR ${npv.irr !== null ? fmtPct(npv.irr) : 'N/A'} below hurdle ${fmtPct(thresholds.hurdleIrr)}`]),
          ...(avgGmY13 < thresholds.gmWarnPct ? [`Avg GM Y1-3 (${fmtPct(avgGmY13)}) below warning threshold`] : []),
          ...(peakWC > peakRevenue * thresholds.wcIntensityWarn ? [`High WC intensity — peak WC ${K(peakWC)} ${cur}`] : []),
        ],
      };
      const blob = await exportCfoPDF(payload);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CFO_${(inp.projectName || 'program').replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setCfoPdfError(err instanceof Error ? err.message : 'PDF generation failed');
    } finally {
      setCfoPdfLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">CFO Dashboard</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCfoPDF}
            disabled={cfoPdfLoading}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed border border-blue-600 rounded text-white font-medium transition-colors"
          >
            {cfoPdfLoading ? 'Generating…' : '↓ CFO PDF'}
          </button>
          <button onClick={onEditThresholds} className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-slate-300">
            ⚙ Thresholds
          </button>
        </div>
      </div>
      {cfoPdfError && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-700 rounded px-3 py-2">{cfoPdfError}</div>
      )}

      {/* GO/NO-GO */}
      <div className={`rounded-lg border p-4 flex items-center gap-4 ${npv.meetsHurdle ? 'bg-green-900/20 border-green-700' : 'bg-red-900/20 border-red-700'}`}>
        <span className={`text-xl font-bold ${npv.meetsHurdle ? 'text-green-300' : 'text-red-300'}`}>
          {npv.meetsHurdle ? '✅ GO — Meets Hurdle' : '❌ NO GO — Below Hurdle'}
        </span>
        <span className="text-xs text-slate-400">IRR ≥ {fmtPct(thresholds.hurdleIrr)} AND NPV &gt; 0</span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Program NPV" value={`${K(npv.npv)} ${cur}`} highlight={tlToHighlight(flagNpv(npv.npv))} sub="discounted at WACC" />
        <KpiCard label="IRR" value={npv.irr !== null ? fmtPct(npv.irr) : 'N/A'} highlight={tlToHighlight(flagIrr(npv.irr, thresholds))} sub={`hurdle ${fmtPct(thresholds.hurdleIrr)}`} />
        <KpiCard label="Payback" value={npv.paybackMonths !== null ? `${npv.paybackMonths.toFixed(0)} mo` : 'N/A'} highlight={tlToHighlight(flagPayback(npv.paybackMonths, thresholds))} sub={`hurdle ${thresholds.hurdlePaybackMonths} mo`} />
        <KpiCard label={`ROCE Y${npv.y3Idx + 1}`} value={fmtPct(npv.roceY3)} highlight={tlToHighlight(flagRoce(npv.roceY3, thresholds))} sub={`hurdle ${fmtPct(thresholds.hurdleRoce)}`} />
        <KpiCard label="Peak Working Capital" value={`${K(peakWC)} ${cur}`} highlight={tlToHighlight(flagWcIntensity(peakWC, peakRevenue, thresholds))} sub="max over lifecycle" />
        <KpiCard label="Tooling Exposure" value={`${K(toolingExposure)} ${cur}`} highlight="none" sub={inp.toolOwnershipType} />
        <KpiCard label="Avg GM Y1–3" value={fmtPct(avgGmY13)} highlight={tlToHighlight(flagGm(avgGmY13, thresholds))} sub="gross margin" />
        <KpiCard label="Total EBITDA" value={`${K(totalEbitda)} ${cur}`} highlight="blue" sub="lifecycle sum" />
      </div>

      {/* Top risks */}
      {top3Risks.length > 0 && (
        <div className="bg-slate-800/60 rounded-lg p-4">
          <SectionHeader title="Top Risk Scenarios (by |ΔNPV|)" />
          <div className="space-y-2">
            {top3Risks.map((r) => (
              <div key={r.name} className="flex items-center justify-between bg-slate-900/40 rounded px-3 py-2 text-sm">
                <span className="text-slate-300 font-medium">{r.name}</span>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className={r.deltaNpv < 0 ? 'text-red-400' : 'text-green-400'}>ΔNPV: {r.deltaNpv >= 0 ? '+' : ''}{K(r.deltaNpv)} {cur}</span>
                  <span className={r.stillMeetsHurdle ? 'text-green-400' : 'text-red-400'}>{r.stillMeetsHurdle ? '✅ GO' : '❌ NO GO'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── P&L Tab ──────────────────────────────────────────────────────────────────
function PnLTab() {
  const { computed, state } = useRfq();
  const { programPnL: pnl } = computed;
  const cur = state.input.currency;

  const totals = {
    volumeUnits: pnl.reduce((s, y) => s + y.volumeUnits, 0),
    revenue: pnl.reduce((s, y) => s + y.revenue, 0),
    cogsMaterial: pnl.reduce((s, y) => s + y.cogsMaterial, 0),
    cogsLabor: pnl.reduce((s, y) => s + y.cogsLabor, 0),
    cogsMachine: pnl.reduce((s, y) => s + y.cogsMachine, 0),
    cogsEnergy: pnl.reduce((s, y) => s + y.cogsEnergy, 0),
    cogsOverheadDirect: pnl.reduce((s, y) => s + y.cogsOverheadDirect, 0),
    cogsToolingAmort: pnl.reduce((s, y) => s + y.cogsToolingAmort, 0),
    grossProfit: pnl.reduce((s, y) => s + y.grossProfit, 0),
    corporateOverheadAlloc: pnl.reduce((s, y) => s + y.corporateOverheadAlloc, 0),
    ebitda: pnl.reduce((s, y) => s + y.ebitda, 0),
    ebit: pnl.reduce((s, y) => s + y.ebit, 0),
  };

  const chartData = pnl.map(y => ({
    year: `Y${y.year}`,
    'Gross Margin %': Math.round(y.grossMarginPct * 1000) / 10,
    'EBITDA %': y.revenue > 0 ? Math.round(y.ebitda / y.revenue * 1000) / 10 : 0,
  }));

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="EBITDA & GM Evolution" />
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} unit="%" />
            <Tooltip formatter={(v: number) => `${v.toFixed(1)} %`} contentStyle={{ background: '#1e293b', border: '1px solid #475569', fontSize: 11 }} />
            <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>} />
            <Bar dataKey="Gross Margin %" fill="#22c55e" radius={[3, 3, 0, 0]} />
            <Bar dataKey="EBITDA %" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-900/60">
              <th className="text-left py-2 px-3 text-slate-400 font-medium">Line item</th>
              {pnl.map(y => <th key={y.year} className="text-right py-2 px-3 text-slate-400 font-medium">Y{y.year}</th>)}
              <th className="text-right py-2 px-3 text-blue-400 font-medium">TOTAL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {([
              ['Volume (pcs)',          pnl.map(y => fmtNum(y.volumeUnits, 0)), fmtNum(totals.volumeUnits, 0), 'text-slate-300'],
              ['Revenue',              pnl.map(y => K(y.revenue)), K(totals.revenue), 'text-blue-300'],
              ['Material COGS',        pnl.map(y => K(y.cogsMaterial)), K(totals.cogsMaterial), 'text-slate-400'],
              ['Labor COGS',           pnl.map(y => K(y.cogsLabor)), K(totals.cogsLabor), 'text-slate-400'],
              ['Machine COGS',         pnl.map(y => K(y.cogsMachine)), K(totals.cogsMachine), 'text-slate-400'],
              ['Energy COGS',          pnl.map(y => K(y.cogsEnergy)), K(totals.cogsEnergy), 'text-slate-400'],
              ['Overhead Direct',      pnl.map(y => K(y.cogsOverheadDirect)), K(totals.cogsOverheadDirect), 'text-slate-400'],
              ['Tooling Amort.',       pnl.map(y => K(y.cogsToolingAmort)), K(totals.cogsToolingAmort), 'text-slate-400'],
              ['Gross Profit',         pnl.map(y => K(y.grossProfit)), K(totals.grossProfit), 'text-green-400'],
              ['GM %',                 pnl.map(y => fmtPct(y.grossMarginPct)), totals.revenue > 0 ? fmtPct(totals.grossProfit / totals.revenue) : '—', 'text-green-300'],
              ['Corp. OH Alloc.',      pnl.map(y => K(y.corporateOverheadAlloc)), K(totals.corporateOverheadAlloc), 'text-slate-400'],
              ['EBITDA',               pnl.map(y => K(y.ebitda)), K(totals.ebitda), 'text-blue-300'],
              ['EBIT',                 pnl.map(y => K(y.ebit)), K(totals.ebit), 'text-blue-200'],
              ['EBIT %',               pnl.map(y => fmtPct(y.ebitPct)), totals.revenue > 0 ? fmtPct(totals.ebit / totals.revenue) : '—', 'text-blue-200'],
            ] as [string, string[], string, string][]).map(([label, vals, total, color]) => (
              <tr key={label} className="hover:bg-slate-700/20">
                <td className="py-1.5 px-3 text-slate-400 font-medium">{label}</td>
                {vals.map((v, i) => <td key={i} className={`py-1.5 px-3 text-right font-mono ${color}`}>{v}</td>)}
                <td className={`py-1.5 px-3 text-right font-mono font-bold ${color}`}>{total}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-xs text-slate-500 mt-1 px-3">Values in {cur}.</div>
      </div>
    </div>
  );
}

// ─── Cash & WC Tab ─────────────────────────────────────────────────────────────
function CashWCTab() {
  const { computed, state } = useRfq();
  const { cashflow: cf, workingCapital: wc } = computed;
  const cur = state.input.currency;
  const inp = state.input;

  const peakRevenue = Math.max(...computed.programPnL.map(y => y.revenue), 1);
  const peakWC = peakNetWC(wc);
  const highWC = peakWC > peakRevenue * 0.25;

  const chartData = cf.map((y, i) => ({
    year: `Y${y.year}`,
    'Cumulative FCF': Math.round(y.cumulativeFCF),
    netWC: Math.round(wc[i]?.netWC ?? 0),
  }));

  return (
    <div className="space-y-6">
      {highWC && (
        <div className="bg-orange-900/30 border border-orange-700 rounded px-4 py-3 text-sm text-orange-300">
          ⚠ High WC intensity — peak WC {K(peakWC)} {cur} exceeds 25% of Y2 revenue.
        </div>
      )}

      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="Cumulative Free Cash Flow" />
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => K(v)} width={64} />
            <Tooltip formatter={(v: number) => `${K(v)} ${cur}`} contentStyle={{ background: '#1e293b', border: '1px solid #475569', fontSize: 11 }} />
            <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
            <Line type="monotone" dataKey="Cumulative FCF" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="netWC" stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-900/60">
              {['Year','EBITDA','Tax','ΔWC','CAPEX','Op.CF','FCF','Cum.FCF','Recv.','Inv.','Pay.','Net WC'].map(h => (
                <th key={h} className="py-2 px-2 text-right first:text-left text-slate-400 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {cf.map((y, i) => (
              <tr key={y.year} className="hover:bg-slate-700/20">
                <td className="py-1.5 px-2 text-slate-300 font-medium">Y{y.year}</td>
                {[y.ebitda, -y.taxPaid, -y.deltaWC, -y.capex, y.operatingCF, y.freeCF, y.cumulativeFCF].map((v, j) => (
                  <td key={j} className={`py-1.5 px-2 text-right font-mono ${v < 0 ? 'text-red-400' : 'text-slate-300'}`}>{K(v)}</td>
                ))}
                {[wc[i]?.receivables ?? 0, wc[i]?.inventory ?? 0, wc[i]?.payables ?? 0, wc[i]?.netWC ?? 0].map((v, j) => (
                  <td key={`wc${j}`} className="py-1.5 px-2 text-right font-mono text-slate-400">{K(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-xs text-slate-500 mt-1 px-2">{cur}. DSO={inp.paymentTerms}d DIO={inp.dioDays}d DPO={inp.dpoDays}d</div>
      </div>
    </div>
  );
}

// ─── CAPEX & Tooling Tab ───────────────────────────────────────────────────────
function CapexTab() {
  const { state, computed } = useRfq();
  const inp = state.input;
  const cur = inp.currency;
  const { programPnL: pnl } = computed;

  const capexY1 = inp.toolOwnershipType === 'supplier' ? inp.toolCost
    : inp.toolOwnershipType === 'customer_amortized' ? inp.toolCost * 0.5 : 0;
  const annualDepreciation = inp.toolOwnershipType === 'supplier' ? inp.toolCost / inp.toolDepreciationYears : 0;

  const deprSchedule = Array.from({ length: Math.round(inp.toolDepreciationYears) }, (_, i) => ({
    year: i + 1,
    depreciation: annualDepreciation,
    nbv: Math.max(0, inp.toolCost - annualDepreciation * (i + 1)),
  }));

  const bevTooling = pnl.length > 0 && pnl[0].cogsToolingAmort > 0
    ? Math.ceil(inp.toolCost / pnl[0].cogsToolingAmort * pnl[0].volumeUnits)
    : 0;

  const annualBankGuarantee = inp.toolCost * inp.bankGuaranteePct;

  const modes: Record<string, string> = {
    customer_paid: 'Customer pays full tooling upfront. Zero CAPEX for supplier. Best cash position.',
    customer_amortized: '50% tooling CAPEX upfront by supplier; amortized through piece price. Moderate cash impact.',
    supplier: 'Supplier owns and depreciates the tool. Full CAPEX exposure. Highest risk.',
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="Tooling Ownership Mode" />
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(modes).map(([mode, desc]) => (
            <div key={mode} className={`rounded-lg border p-3 ${inp.toolOwnershipType === mode ? 'border-blue-500 bg-blue-900/20' : 'border-slate-700 bg-slate-900/40'}`}>
              <div className="text-sm font-semibold text-slate-200 mb-1 capitalize">{mode.replace(/_/g, ' ')}</div>
              <div className="text-xs text-slate-400">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Tooling Cost" value={`${K(inp.toolCost)} ${cur}`} highlight="none" />
        <KpiCard label="Supplier CAPEX Y1" value={`${K(capexY1)} ${cur}`} highlight={capexY1 > 0 ? 'yellow' : 'green'} />
        <KpiCard label="BEV Volume (tooling)" value={bevTooling > 0 ? fmtNum(bevTooling, 0) : 'N/A'} highlight="none" sub="units to recover tool" />
        <KpiCard label="Bank Guarantee p.a." value={`${K(annualBankGuarantee)} ${cur}`} highlight="none" sub={`${(inp.bankGuaranteePct * 100).toFixed(2)}% of tool`} />
      </div>

      {inp.toolOwnershipType === 'supplier' && deprSchedule.length > 0 && (
        <div className="bg-slate-800/60 rounded-lg p-4">
          <SectionHeader title="Depreciation Schedule (supplier-owned tool)" />
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-900/60">
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Year</th>
                <th className="text-right py-2 px-3 text-slate-400 font-medium">Depreciation</th>
                <th className="text-right py-2 px-3 text-slate-400 font-medium">NBV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {deprSchedule.map(r => (
                <tr key={r.year} className="hover:bg-slate-700/20">
                  <td className="py-1.5 px-3 text-slate-300">Y{r.year}</td>
                  <td className="py-1.5 px-3 text-right font-mono text-red-400">{K(r.depreciation)} {cur}</td>
                  <td className="py-1.5 px-3 text-right font-mono text-slate-300">{K(r.nbv)} {cur}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="Volume Risk — Under-amortized Tooling" />
        {([20, 40] as const).map(pct => {
          const scaledVol = pnl.reduce((s, y) => s + y.volumeUnits, 0) * (1 - pct / 100);
          const recoveredTool = pnl.length > 0 ? scaledVol * pnl[0].cogsToolingAmort / pnl[0].volumeUnits : 0;
          const shortfall = Math.max(0, inp.toolCost - recoveredTool);
          return (
            <div key={pct} className="flex justify-between items-center py-2 border-b border-slate-700 last:border-0 text-sm">
              <span className="text-slate-400">Volume −{pct}%</span>
              <span className={`font-mono ${shortfall > 0 ? 'text-red-400' : 'text-green-400'}`}>
                Shortfall: {K(shortfall)} {cur}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Risk & FX Tab ─────────────────────────────────────────────────────────────
function RiskFxTab({ thresholds }: { thresholds: FinancialThresholds }) {
  const { computed, state } = useRfq();
  const { financialRisk: risks, fxExposure: fx, npv } = computed;
  const inp = state.input;
  const cur = inp.currency;

  const baseNpv = npv.npv;

  const fxLevel = Math.abs(fx.netOpenEur) / Math.max(fx.revenueEur, 1);
  const fxBadge = fxLevel < 0.1 ? 'LOW' : fxLevel < 0.25 ? 'MEDIUM' : 'HIGH';
  const fxBadgeColor = fxLevel < 0.1 ? 'text-green-400 bg-green-900/30 border-green-700' : fxLevel < 0.25 ? 'text-yellow-400 bg-yellow-900/30 border-yellow-700' : 'text-red-400 bg-red-900/30 border-red-700';

  // Waterfall data
  const waterfallData = [
    { name: 'Base NPV', value: baseNpv, fill: '#3b82f6' },
    ...risks.slice(0, 5).map(r => ({ name: r.name, value: r.deltaNpv, fill: r.deltaNpv < 0 ? '#ef4444' : '#22c55e' })),
  ];

  return (
    <div className="space-y-6">
      {/* Risk table */}
      <div className="bg-slate-800/60 rounded-lg overflow-hidden">
        <SectionHeader title="Sensitivity Analysis — Program P&L Shocks" className="px-4 pt-4 mb-0 pb-3" />
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-900/60">
              <th className="text-left py-2 px-4 text-slate-400 font-medium">Scenario</th>
              <th className="text-right py-2 px-4 text-slate-400 font-medium">ΔNPV</th>
              <th className="text-right py-2 px-4 text-slate-400 font-medium">ΔEBITDA Y2</th>
              <th className="text-right py-2 px-4 text-slate-400 font-medium">New IRR</th>
              <th className="text-right py-2 px-4 text-slate-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {risks.map(r => (
              <tr key={r.name} className="hover:bg-slate-700/20">
                <td className="py-2 px-4 text-slate-300 font-medium">{r.name}</td>
                <td className={`py-2 px-4 text-right font-mono ${r.deltaNpv < 0 ? 'text-red-400' : 'text-green-400'}`}>{r.deltaNpv >= 0 ? '+' : ''}{K(r.deltaNpv)} {cur}</td>
                <td className={`py-2 px-4 text-right font-mono ${r.deltaEbitdaY2 < 0 ? 'text-red-400' : 'text-green-400'}`}>{r.deltaEbitdaY2 >= 0 ? '+' : ''}{K(r.deltaEbitdaY2)} {cur}</td>
                <td className="py-2 px-4 text-right font-mono text-slate-300">{r.newIrr !== null ? fmtPct(r.newIrr) : 'N/A'}</td>
                <td className={`py-2 px-4 text-right font-medium ${r.stillMeetsHurdle ? 'text-green-400' : 'text-red-400'}`}>{r.stillMeetsHurdle ? '✅ GO' : '❌ NO GO'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Waterfall */}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="NPV Waterfall" />
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={waterfallData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => K(v)} width={64} />
            <Tooltip formatter={(v: number) => `${K(v)} ${cur}`} contentStyle={{ background: '#1e293b', border: '1px solid #475569', fontSize: 11 }} />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {waterfallData.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* FX section */}
      <div className="bg-slate-800/60 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <SectionHeader title="FX Exposure" className="mb-0 border-0 pb-0" />
          <span className={`px-2 py-0.5 rounded border text-xs font-semibold ${fxBadgeColor}`}>FX exposure: {fxBadge}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {[
            ['Revenue (EUR avg)', `${fmtPrice(fx.revenueEur, 0)} EUR`],
            ['Cost (EUR avg)', `${fmtPrice(fx.costEur, 0)} EUR`],
            ['Natural Hedge', fmtPct(fx.naturalHedgePct / 100)],
            ['Net Open (unhedged)', `${fmtPrice(fx.unhedgedEur, 0)} EUR`],
            ['Margin Impact EUR+10%', `+${fx.marginImpactFxPlus10Pp.toFixed(2)} pp`],
            ['Margin Impact EUR−10%', `${fx.marginImpactFxMinus10Pp.toFixed(2)} pp`],
            ['Hedge Ratio', fmtPct(inp.fxHedgeRatio)],
            ['Ref EUR/PLN', inp.fxEurPln.toFixed(2)],
          ].map(([label, value]) => (
            <div key={label} className="bg-slate-900/40 rounded p-2">
              <div className="text-slate-400 mb-0.5">{label}</div>
              <div className="font-mono font-semibold text-slate-200">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Commercial Tab ────────────────────────────────────────────────────────────
function CommercialTab() {
  const { state, computed } = useRfq();
  const inp = state.input;
  const cur = inp.currency;
  const { programPnL: pnl, priceStrategy: ps } = computed;

  const totalRevenue = pnl.reduce((s, y) => s + y.revenue, 0);
  const avgAnnualRevenue = totalRevenue / Math.max(pnl.length, 1);

  // Payment terms cost comparison
  const financingRate = 0.06;
  const ptRows = [30, 45, 60, 90].map(days => ({
    days,
    financingCost: ps.target.price * days / 365 * financingRate,
    marginImpactPp: ps.target.price > 0 ? (ps.target.price * days / 365 * financingRate / ps.target.price) * 100 : 0,
  }));

  // Warranty
  const annualWarranty = avgAnnualRevenue * inp.warrantyReservePct;
  const cumulatedWarranty = annualWarranty * inp.lifecycleYears;

  // LD cap
  const ldCapValue = totalRevenue * inp.ldCapPct;

  // Credit risk
  const RATING_DEFAULT_PROB: Record<string, number> = {
    AAA: 0.0002, AA: 0.0008, A: 0.0020, BBB: 0.0060, BB: 0.0180, B: 0.0500, CCC: 0.1500, UNRATED: 0.0200,
  };
  const pd = RATING_DEFAULT_PROB[inp.customerRating] ?? 0.02;
  const totalExposure = avgAnnualRevenue * (inp.paymentTerms / 360);
  const uninsuredExposure = totalExposure * (1 - inp.customerInsuredPct);
  const expectedLoss = uninsuredExposure * pd;

  return (
    <div className="space-y-6">
      {/* Payment terms */}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="Payment Terms — Cost of Trade Finance" />
        <p className="text-xs text-slate-400 -mt-2 mb-3">Financing at 6% p.a. — impact on margin per part.</p>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-900/60">
              <th className="text-left py-2 px-3 text-slate-400">Terms</th>
              <th className="text-right py-2 px-3 text-slate-400">Financing cost/part</th>
              <th className="text-right py-2 px-3 text-slate-400">Margin impact (pp)</th>
              <th className="py-2 px-3 text-center text-slate-400">vs current</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {ptRows.map(r => (
              <tr key={r.days} className={`hover:bg-slate-700/20 ${r.days === inp.paymentTerms ? 'bg-blue-900/10' : ''}`}>
                <td className="py-1.5 px-3 text-slate-300 font-medium">Net {r.days}</td>
                <td className="py-1.5 px-3 text-right font-mono text-slate-300">{fmtPrice(r.financingCost)} {cur}</td>
                <td className="py-1.5 px-3 text-right font-mono text-orange-300">{r.marginImpactPp.toFixed(2)} pp</td>
                <td className="py-1.5 px-3 text-center text-xs">{r.days === inp.paymentTerms ? <span className="text-blue-300">← current</span> : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Warranty + LD */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/60 rounded-lg p-4">
          <SectionHeader title="Warranty Reserve" />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Annual reserve</span><span className="font-mono text-orange-300">{K(annualWarranty)} {cur}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Lifecycle total</span><span className="font-mono text-orange-300">{K(cumulatedWarranty)} {cur}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Reserve %</span><span className="font-mono text-slate-300">{fmtPct(inp.warrantyReservePct)}</span></div>
          </div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-4">
          <SectionHeader title="LD Cap Exposure" />
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">LD cap value</span><span className="font-mono text-red-300">{K(ldCapValue)} {cur}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">As % of revenue</span><span className="font-mono text-slate-300">{fmtPct(inp.ldCapPct)}</span></div>
          </div>
        </div>
      </div>

      {/* Credit risk */}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="Customer Credit Risk" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-3">
          <div className="bg-slate-900/40 rounded p-2"><div className="text-slate-400 mb-0.5">Customer Rating</div><div className="font-semibold text-slate-200">{inp.customerRating}</div></div>
          <div className="bg-slate-900/40 rounded p-2"><div className="text-slate-400 mb-0.5">1-Year PD</div><div className="font-mono font-semibold text-slate-200">{(pd * 100).toFixed(2)}%</div></div>
          <div className="bg-slate-900/40 rounded p-2"><div className="text-slate-400 mb-0.5">Total Exposure</div><div className="font-mono font-semibold text-slate-200">{K(totalExposure)} {cur}</div></div>
          <div className="bg-slate-900/40 rounded p-2"><div className="text-slate-400 mb-0.5">Uninsured Exposure</div><div className={`font-mono font-semibold ${uninsuredExposure > totalExposure * 0.3 ? 'text-red-400' : 'text-green-400'}`}>{K(uninsuredExposure)} {cur}</div></div>
        </div>
        <div className="flex justify-between items-center text-sm border-t border-slate-700 pt-3">
          <span className="text-slate-400">Expected credit loss (annual)</span>
          <span className="font-mono text-red-400 font-semibold">{K(expectedLoss)} {cur}</span>
        </div>
        <div className="mt-2 text-xs text-slate-500">Insurance covers {fmtPct(inp.customerInsuredPct)} of exposure. Uninsured: {fmtPct(1 - inp.customerInsuredPct)}.</div>
      </div>
    </div>
  );
}

// ─── Thresholds editor modal ───────────────────────────────────────────────────
function ThresholdsModal({ thresholds, onSave, onClose }: { thresholds: FinancialThresholds; onSave: (t: FinancialThresholds) => void; onClose: () => void }) {
  const [local, setLocal] = useState({ ...thresholds });
  function set(key: keyof FinancialThresholds, pct: string) {
    setLocal(prev => ({ ...prev, [key]: parseFloat(pct) / 100 || 0 }));
  }
  function setPct(key: keyof FinancialThresholds, val: string) {
    if (key === 'hurdlePaybackMonths') setLocal(prev => ({ ...prev, [key]: parseFloat(val) || 0 }));
    else set(key, val);
  }
  const rows: [keyof FinancialThresholds, string, boolean][] = [
    ['hurdleIrr', 'Hurdle IRR', false],
    ['hurdleRoce', 'Hurdle ROCE', false],
    ['hurdlePaybackMonths', 'Hurdle Payback (months)', true],
    ['wcIntensityWarn', 'WC Intensity Warn', false],
    ['wcIntensityCrit', 'WC Intensity Crit', false],
    ['gmWarnPct', 'GM Warn %', false],
    ['gmCritPct', 'GM Crit %', false],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Corporate Thresholds</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-bold">✕</button>
        </div>
        <div className="space-y-3">
          {rows.map(([key, label, isMonths]) => (
            <label key={key} className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400">{label}</span>
              <div className="flex items-center gap-1">
                <input type="number" step={isMonths ? '1' : '0.1'} min="0"
                  value={isMonths ? local[key] : (local[key] as number * 100).toFixed(1)}
                  onChange={e => setPct(key, e.target.value)}
                  className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs font-mono text-slate-100 focus:outline-none focus:border-blue-500" />
                <span className="text-xs text-slate-500 w-6">{isMonths ? 'mo' : '%'}</span>
              </div>
            </label>
          ))}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={() => { onSave(local); onClose(); }} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded transition-colors">Save</button>
          <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Financials component ─────────────────────────────────────────────────
export function Financials() {
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [showThresholds, setShowThresholds] = useState(false);
  const { state, dispatch } = useRfq();
  const thresholds = state.financialThresholds;

  function handleSaveThresholds(t: FinancialThresholds) {
    dispatch({ type: 'SET_FINANCIAL_THRESHOLDS', payload: t });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-100">Financial Analysis</h1>
        <p className="text-xs text-slate-400">CFO-level program economics — lifecycle P&L, cash flow, NPV/IRR, risk scenarios.</p>
      </div>

      {showThresholds && (
        <ThresholdsModal thresholds={thresholds} onSave={handleSaveThresholds} onClose={() => setShowThresholds(false)} />
      )}

      {/* Sub-tab navigation */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-700 pb-0">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`flex-shrink-0 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap -mb-px
              ${subTab === t.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div className="pt-2">
        {subTab === 'overview'    && <OverviewTab thresholds={thresholds} onEditThresholds={() => setShowThresholds(true)} />}
        {subTab === 'pnl'        && <PnLTab />}
        {subTab === 'cashwc'     && <CashWCTab />}
        {subTab === 'capex'      && <CapexTab />}
        {subTab === 'riskfx'     && <RiskFxTab thresholds={thresholds} />}
        {subTab === 'commercial' && <CommercialTab />}
      </div>
    </div>
  );
}
