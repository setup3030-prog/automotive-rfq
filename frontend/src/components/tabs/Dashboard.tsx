import React, { useState } from 'react';
import { useRfq } from '../../context/RfqContext';
import { KpiCard } from '../ui/KpiCard';
import { StatusBadge } from '../ui/StatusBadge';
import { SectionHeader } from '../ui/SectionHeader';
import { CostBreakdownChart } from '../charts/CostBreakdownChart';
import { PriceComparisonChart } from '../charts/PriceComparisonChart';
import { fmtPrice, fmtPct, fmtNum } from '../../utils/formatters';
import { exportPDF } from '../../api/client';

export function Dashboard() {
  const { state, computed, dispatch } = useRfq();
  const { costModel: cm, priceStrategy: ps, competitiveness: comp } = computed;
  const inp = state.input;
  const cur = inp.currency;

  // GO/NO GO
  const targetMargin = ps.target.margin;
  const marginMin = state.priceMargins.marginMin;
  let decision = { text: '', color: 'green' as 'red' | 'yellow' | 'green' };
  if (targetMargin < 0.06) {
    decision = { text: '🔴 HIGH RISK — MARGIN TOO THIN', color: 'red' };
  } else if (targetMargin < 0.14) {
    decision = { text: '🟡 PROCEED WITH CAUTION', color: 'yellow' };
  } else {
    decision = { text: '✅ GO — QUOTE AT TARGET PRICE', color: 'green' };
  }

  const decisionBg = decision.color === 'red'
    ? 'bg-red-900/30 border-red-700'
    : decision.color === 'yellow'
    ? 'bg-yellow-900/30 border-yellow-700'
    : 'bg-green-900/30 border-green-700';

  const decisionTextColor = decision.color === 'red' ? 'text-red-300' : decision.color === 'yellow' ? 'text-yellow-300' : 'text-green-300';

  // Risk indicators
  const machineUtil = cm.machine.machineUtilization;
  const marginAtAggressive = ps.aggressive.margin;

  // Print handler
  const handlePrint = () => window.print();

  // PDF export handler
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handleExportPDF = async () => {
    setPdfLoading(true);
    setPdfError(null);
    try {
      const payload = {
        rfq_name: inp.projectName,
        customer: inp.customerName,
        part_number: inp.partNumber,
        part_description: inp.partDescription,
        quoting_engineer: inp.quotingEngineer,
        rfq_date: inp.rfqDate,
        currency: inp.currency,
        annual_volume: inp.volMid,
        cycle_time_s: inp.cycleTimeActual,
        cavities: inp.cavities,
        oee_pct: inp.oee * 100,
        scrap_rate_pct: inp.scrapRate * 100,
        machine_cost: cm.machine.totalMachineCost,
        material_cost: cm.material.totalMaterialCost,
        tooling_cost: cm.tooling.totalToolingCost,
        labor_cost: cm.labor.totalLaborCost,
        energy_cost: cm.energy.totalEnergyCost,
        overhead_cost: cm.overhead.totalOverhead,
        logistics_packaging: inp.packagingCost + inp.logisticsCost,
        total_cost: cm.totalMfgCost,
        walk_away_price: ps.walkAway.price,
        target_price_calc: ps.target.price,
        aggressive_price: ps.aggressive.price,
        walk_away_margin: ps.walkAway.margin,
        target_margin: ps.target.margin,
        aggressive_margin: ps.aggressive.margin,
        customer_target_price: inp.targetPrice || null,
        decision: decision.text,
      };
      const blob = await exportPDF(payload);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RFQ_${(inp.projectName || 'quote').replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setPdfError(err instanceof Error ? err.message : 'PDF export failed');
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Dashboard</h1>
          <p className="text-xs text-slate-400">
            {inp.customerName} | {inp.projectName} | {inp.partNumber}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 text-xs rounded font-medium transition-colors"
          >
            Print A4
          </button>
          <button
            onClick={handleExportPDF}
            disabled={pdfLoading}
            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed border border-blue-600 text-white text-xs rounded font-medium transition-colors"
          >
            {pdfLoading ? 'Generating…' : 'Download PDF Quote'}
          </button>
        </div>
        {pdfError && (
          <div className="w-full text-xs text-red-400 mt-1 print:hidden">{pdfError}</div>
        )}
      </div>

      {/* GO/NO GO Banner */}
      <div className={`rounded-lg border p-4 flex items-center gap-4 ${decisionBg}`}>
        <div className={`text-xl font-bold ${decisionTextColor}`}>{decision.text}</div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Total Mfg Cost"
          value={`${fmtPrice(cm.totalMfgCost)} ${cur}`}
          sub="All-in manufacturing cost/part"
          highlight="none"
        />
        <KpiCard
          label="Walk-Away Price"
          value={`${fmtPrice(ps.walkAway.price)} ${cur}`}
          sub={`Margin: ${fmtPct(ps.walkAway.margin)}`}
          highlight="red"
        />
        <KpiCard
          label="Target Price"
          value={`${fmtPrice(ps.target.price)} ${cur}`}
          sub={`Margin: ${fmtPct(ps.target.margin)}`}
          highlight="green"
        />
        <KpiCard
          label="Aggressive Price"
          value={`${fmtPrice(ps.aggressive.price)} ${cur}`}
          sub={`Margin: ${fmtPct(ps.aggressive.margin)}`}
          highlight="yellow"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Customer Target"
          value={`${fmtPrice(inp.targetPrice)} ${cur}`}
          sub={`Gap to our target: ${fmtPrice(ps.target.price - inp.targetPrice)} ${cur}`}
          highlight="blue"
        />
        <KpiCard
          label="Target Margin €"
          value={`${fmtPrice(ps.target.grossMarginPerPart)} ${cur}`}
          sub={`${fmtPct(ps.target.margin)} margin`}
          highlight={ps.target.margin > 0.15 ? 'green' : ps.target.margin > 0.08 ? 'yellow' : 'red'}
        />
        <KpiCard
          label="Annual Profit (Target)"
          value={`${fmtNum(ps.target.annualProfit, 0)} ${cur}`}
          sub={`At ${fmtNum(inp.volMid, 0)} pcs/yr`}
          highlight={ps.target.annualProfit > 0 ? 'green' : 'red'}
        />
        <KpiCard
          label="Break-Even Volume"
          value={`${fmtNum(ps.walkAway.breakEvenVolume, 0)} pcs`}
          sub={`vs Mid Vol: ${fmtNum(inp.volMid, 0)} pcs`}
          highlight={ps.walkAway.breakEvenVolume < inp.volMid ? 'green' : 'red'}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/60 rounded-lg p-4">
          <SectionHeader title="Cost Breakdown" />
          <CostBreakdownChart cost={cm} currency={cur} />
        </div>
        <div className="bg-slate-800/60 rounded-lg p-4">
          <SectionHeader title="Price vs Cost" />
          <PriceComparisonChart
            cost={cm}
            prices={ps}
            comp={comp}
            currency={cur}
            customerTarget={inp.targetPrice}
          />
        </div>
      </div>

      {/* Competitive Status */}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="Competitive Status" />
        <div className="flex items-center gap-4 flex-wrap">
          <StatusBadge text={comp.competitiveStatus} size="lg" />
          <div className="text-sm text-slate-400">
            Competitor range: <span className="font-mono text-slate-200">{fmtPrice(state.competitiveness.competitorPriceLow)}–{fmtPrice(state.competitiveness.competitorPriceHigh)} {cur}</span>
            &nbsp;| Mid: <span className="font-mono text-slate-200">{fmtPrice(comp.competitorMid)} {cur}</span>
          </div>
        </div>
      </div>

      {/* Risk Indicators */}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="Risk Indicators" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            {
              label: 'Machine Utilization',
              value: fmtPct(machineUtil),
              color: machineUtil > 0.90 ? 'text-red-400' : machineUtil > 0.75 ? 'text-yellow-400' : 'text-green-400',
              warn: machineUtil > 0.90 ? '⚠ OVERLOADED' : machineUtil > 0.75 ? 'HIGH' : 'OK',
            },
            {
              label: 'Scrap (Used)',
              value: fmtPct(cm.guards.scrapUsed),
              color: cm.guards.scrapWarning ? 'text-yellow-400' : 'text-green-400',
              warn: cm.guards.scrapWarning ? '⚠ FLOORED' : 'OK',
            },
            {
              label: 'OEE (Used)',
              value: fmtPct(cm.guards.oeeUsed),
              color: cm.guards.oeeWarning ? 'text-yellow-400' : 'text-green-400',
              warn: cm.guards.oeeWarning ? '⚠ CAPPED' : 'OK',
            },
            {
              label: 'Margin @ Target',
              value: fmtPct(targetMargin),
              color: targetMargin > 0.15 ? 'text-green-400' : targetMargin > 0.08 ? 'text-yellow-400' : 'text-red-400',
              warn: targetMargin > 0.15 ? 'STRONG' : targetMargin > 0.08 ? 'WATCH' : '⚠ THIN',
            },
            {
              label: 'Margin @ Aggressive',
              value: fmtPct(marginAtAggressive),
              color: marginAtAggressive > 0.12 ? 'text-green-400' : marginAtAggressive > 0.06 ? 'text-yellow-400' : 'text-red-400',
              warn: marginAtAggressive > 0.12 ? 'OK' : marginAtAggressive > 0.06 ? 'WATCH' : '⚠ LOW',
            },
          ].map((k) => (
            <div key={k.label} className="bg-slate-900/50 rounded p-3">
              <div className="text-xs text-slate-400 mb-1">{k.label}</div>
              <div className={`font-mono font-bold text-lg ${k.color}`}>{k.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{k.warn}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cost detail summary */}
      <div className="bg-slate-800/60 rounded-lg overflow-hidden">
        <SectionHeader title="Cost Summary" className="px-4 pt-4 mb-0 pb-3" />
        <table className="w-full">
          <thead>
            <tr className="bg-slate-900/50">
              <th className="text-left py-2 px-4 text-xs text-slate-400 font-medium">Category</th>
              <th className="text-right py-2 px-4 text-xs text-slate-400 font-medium">Cost/Part</th>
              <th className="text-right py-2 px-4 text-xs text-slate-400 font-medium">% of Total</th>
              <th className="text-right py-2 px-4 text-xs text-slate-400 font-medium">Annual Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {[
              { label: 'Machine', v: cm.machine.totalMachineCost },
              { label: 'Material', v: cm.material.totalMaterialCost },
              { label: 'Tooling', v: cm.tooling.totalToolingCost },
              { label: 'Labor', v: cm.labor.totalLaborCost },
              { label: 'Energy', v: cm.energy.totalEnergyCost },
              { label: 'Overhead', v: cm.overhead.totalOverhead },
              { label: 'Pack + Log', v: inp.packagingCost + inp.logisticsCost },
            ].map((r) => (
              <tr key={r.label} className="hover:bg-slate-700/30">
                <td className="py-1.5 px-4 text-sm text-slate-300">{r.label}</td>
                <td className="py-1.5 px-4 text-right font-mono text-sm text-blue-300">{fmtPrice(r.v)} {cur}</td>
                <td className="py-1.5 px-4 text-right font-mono text-sm text-slate-400">
                  {fmtPct(cm.totalMfgCost > 0 ? r.v / cm.totalMfgCost : 0)}
                </td>
                <td className="py-1.5 px-4 text-right font-mono text-sm text-slate-300">{fmtNum(r.v * inp.volMid, 0)} {cur}</td>
              </tr>
            ))}
            <tr className="bg-blue-900/20 font-semibold">
              <td className="py-2 px-4 text-sm text-slate-100">TOTAL MFG COST</td>
              <td className="py-2 px-4 text-right font-mono text-sm text-blue-300 font-bold">{fmtPrice(cm.totalMfgCost)} {cur}</td>
              <td className="py-2 px-4 text-right font-mono text-sm text-slate-300">100%</td>
              <td className="py-2 px-4 text-right font-mono text-sm text-slate-100">{fmtNum(cm.totalMfgCost * inp.volMid, 0)} {cur}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Recommendation Banner */}
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-4 print:border-black">
        <div className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-medium">Quote Recommendation</div>
        <div className="text-sm font-mono text-slate-200 leading-relaxed">
          <span className="text-blue-400 font-bold">{inp.customerName}</span> |{' '}
          <span className="text-slate-300">{inp.projectName}</span>
          {' — '}
          Opening: <span className="text-green-400 font-bold">{fmtPrice(ps.target.price)} {cur}</span>
          {' | '}
          Min: <span className="text-red-400 font-bold">{fmtPrice(ps.walkAway.price)} {cur}</span>
          {' | '}
          Aggressive: <span className="text-yellow-400 font-bold">{fmtPrice(ps.aggressive.price)} {cur}</span>
          {' — '}
          Annual Profit (target): <span className="text-green-400 font-bold">{fmtNum(ps.target.annualProfit, 0)} {cur}</span>
        </div>
      </div>

      {/* Guards summary */}
      {(cm.guards.oeeWarning || cm.guards.scrapWarning || cm.guards.cycleOptimizedWarning) && (
        <div className="space-y-1">
          {cm.guards.oeeWarning && <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded px-3 py-1.5">⚠ OEE CAPPED at 90% (input: {fmtPct(inp.oee)})</div>}
          {cm.guards.scrapWarning && <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded px-3 py-1.5">⚠ SCRAP FLOORED at 2% (input: {fmtPct(inp.scrapRate)})</div>}
          {cm.guards.cycleOptimizedWarning && <div className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded px-3 py-1.5">⚠ OPTIMIZED CYCLE &gt;25% BETTER THAN ACTUAL — VERIFY</div>}
        </div>
      )}
    </div>
  );
}
