import React from 'react';
import { useRfq } from '../../context/RfqContext';
import { SectionHeader } from '../ui/SectionHeader';
import { fmtPrice, fmtPct, fmtNum } from '../../utils/formatters';
import type { NegotiationChecklist } from '../../types/rfq';

export function NegotiationSupport() {
  const { state, computed, dispatch } = useRfq();
  const { priceStrategy: ps, costModel: cm } = computed;
  const inp = state.input;
  const cur = inp.currency;
  const checklist = state.checklist;

  function setCheck(key: keyof NegotiationChecklist) {
    dispatch({ type: 'SET_CHECKLIST', payload: { [key]: !checklist[key] } });
  }

  const matPct = cm.totalMfgCost > 0 ? cm.material.totalMaterialCost / cm.totalMfgCost : 0;
  const energyPct = cm.totalMfgCost > 0 ? cm.energy.totalEnergyCost / cm.totalMfgCost : 0;

  const arguments_list = [
    {
      title: 'Material Cost Driver',
      text: `Material (${fmtPrice(inp.materialPrice, 2)} ${cur}/kg) accounts for ${fmtPct(matPct)} of cost. ${inp.materialGrade} material is volatile — indexed to oil prices.`,
    },
    {
      title: 'Energy Cost Driver',
      text: `Energy at ${fmtPrice(inp.energyPrice, 2)} ${cur}/kWh represents ${fmtPct(energyPct)} of cost. EU energy prices up 40% since 2021.`,
    },
    {
      title: 'Machine Investment',
      text: `${inp.machineSize}-tonne press at ${fmtPrice(inp.machineHourlyRate, 2)} ${cur}/h. Modern servo-hydraulic press required for part tolerances.`,
    },
    {
      title: 'Tooling Complexity',
      text: `Tool cost ${fmtNum(inp.toolCost, 0)} ${cur} — ${inp.cavities >= 4 ? `hot runner system with ${inp.cavities} cavities` : 'single-cavity tool: higher amortization per part'}.`,
    },
    {
      title: 'Quality & Certification',
      text: 'IATF 16949 certified facility. Full PPAP capability. Zero-defect quality system with SPC monitoring and customer-specific requirements applied.',
    },
    {
      title: 'Realistic OEE',
      text: `OEE of ${fmtPct(inp.oee)} used — NOT 95%. Includes planned maintenance, changeovers, and startup scrap. Competitive benchmark, not wishful thinking.`,
    },
    {
      title: 'Labor Reality',
      text: `Direct labor ${fmtPrice(inp.laborRate, 2)} ${cur}/h — actual fully loaded rate. ${inp.operatorsPerMachine} operator(s) per machine. Indirect labor at ${fmtPct(inp.indirectLaborFactor)} of direct.`,
    },
  ];

  const levers = [
    {
      lever: 'Volume +50%',
      concession: '-5% on target price',
      newPrice: ps.target.price * 0.95,
      savings: ps.target.price * 0.05 * inp.volMid * 1.5,
    },
    {
      lever: 'Volume +100%',
      concession: '-8% on target price',
      newPrice: ps.target.price * 0.92,
      savings: ps.target.price * 0.08 * inp.volMid * 2,
    },
    {
      lever: `Contract +2 years`,
      concession: '-4% on target price',
      newPrice: ps.target.price * 0.96,
      savings: ps.target.price * 0.04 * inp.volMid * (inp.contractDuration + 2),
    },
    {
      lever: 'Payment 30 days',
      concession: `Financing saving ${fmtPrice(cm.totalMfgCost * 30 / 365 * 0.06)} ${cur}/part`,
      newPrice: ps.target.price - cm.totalMfgCost * 30 / 365 * 0.06,
      savings: cm.totalMfgCost * 30 / 365 * 0.06 * inp.volMid,
    },
    {
      lever: 'Customer owns tooling',
      concession: `Remove tooling cost ${fmtPrice(cm.tooling.totalToolingCost)} ${cur}/part`,
      newPrice: ps.target.price - cm.tooling.totalToolingCost * (inp.toolOwnership as number),
      savings: cm.tooling.totalToolingCost * (inp.toolOwnership as number) * inp.volMid,
    },
    {
      lever: 'Annual price reduction 2%/yr',
      concession: 'Conditional',
      newPrice: -1,
      savings: -1,
    },
  ];

  const checkItems: { key: keyof NegotiationChecklist; label: string }[] = [
    { key: 'volumeCommitment', label: 'Confirm annual volume commitment in writing' },
    { key: 'toolingOwnership', label: 'Agree tooling ownership and amortization basis' },
    { key: 'sopDate', label: 'Confirm SOP date and ramp schedule' },
    { key: 'materialIndex', label: 'Agree material index clause (quarterly review)' },
    { key: 'energySurcharge', label: 'Agree energy surcharge clause' },
    { key: 'packagingSpec', label: 'Confirm packaging specification and cost' },
    { key: 'paymentTerms', label: 'Agree payment terms and currency' },
    { key: 'qualityRequirements', label: 'Confirm quality requirements (PPAP level?)' },
    { key: 'productivityTarget', label: 'Agree annual productivity target (RD&A)' },
    { key: 'contractDuration', label: 'Confirm contract duration and termination clause' },
    { key: 'toolingTransferRisk', label: 'Check for tooling transfer risk on award' },
    { key: 'competitorLikeForLike', label: 'Validate competitor quotes are like-for-like' },
  ];

  const doneCount = Object.values(checklist).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-100">Negotiation Support</h1>
        <p className="text-xs text-slate-400">Auto-generated from RFQ data. Checklist saved in localStorage.</p>
      </div>

      {/* Opening Strategy */}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="Opening Strategy" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Suggested Opening Price', value: `${fmtPrice(ps.target.price)} ${cur}`, color: 'text-green-400' },
            { label: 'Min Acceptable (Walk-Away)', value: `${fmtPrice(ps.walkAway.price)} ${cur}`, color: 'text-red-400' },
            { label: 'Aggressive Win Price', value: `${fmtPrice(ps.aggressive.price)} ${cur}`, color: 'text-yellow-400' },
            { label: 'Customer Target', value: `${fmtPrice(inp.targetPrice)} ${cur}`, color: 'text-purple-400' },
            { label: 'Gap to Close', value: `${fmtPrice(ps.target.price - inp.targetPrice)} ${cur}`, color: ps.target.price - inp.targetPrice <= 0 ? 'text-green-400' : 'text-red-400' },
            { label: 'Max Discount Available', value: `${fmtPrice(ps.target.price - ps.walkAway.price)} ${cur}`, color: 'text-blue-400' },
          ].map((k) => (
            <div key={k.label} className="bg-slate-900/50 rounded p-3">
              <div className="text-xs text-slate-400 mb-1">{k.label}</div>
              <div className={`font-mono font-bold ${k.color}`}>{k.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Arguments */}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <SectionHeader title="Negotiation Arguments (auto-generated)" />
        <div className="space-y-3">
          {arguments_list.map((arg, i) => (
            <div key={i} className="flex gap-3 p-3 bg-slate-900/40 rounded border border-slate-700/50">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold">
                {i + 1}
              </div>
              <div>
                <div className="text-sm font-semibold text-blue-300 mb-0.5">{arg.title}</div>
                <div className="text-xs text-slate-300 leading-relaxed">{arg.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Concession Levers */}
      <div className="bg-slate-800/60 rounded-lg overflow-hidden">
        <SectionHeader title="Concession Levers" className="px-4 pt-4 mb-0 pb-3" />
        <table className="w-full">
          <thead>
            <tr className="bg-slate-900/50">
              <th className="text-left py-2 px-4 text-xs text-slate-400 font-medium">Lever</th>
              <th className="text-left py-2 px-4 text-xs text-slate-400 font-medium">Concession</th>
              <th className="text-right py-2 px-4 text-xs text-slate-400 font-medium">New Price</th>
              <th className="text-right py-2 px-4 text-xs text-slate-400 font-medium">Annual Saving</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {levers.map((l) => (
              <tr key={l.lever} className="hover:bg-slate-700/30">
                <td className="py-2 px-4 text-sm font-medium text-slate-200">{l.lever}</td>
                <td className="py-2 px-4 text-xs text-slate-400">{l.concession}</td>
                <td className="py-2 px-4 text-right font-mono text-sm text-yellow-300">
                  {l.newPrice >= 0 ? `${fmtPrice(l.newPrice)} ${cur}` : 'Conditional'}
                </td>
                <td className="py-2 px-4 text-right font-mono text-sm text-green-400">
                  {l.savings >= 0 ? `${fmtNum(l.savings, 0)} ${cur}` : 'Negotiate'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Checklist */}
      <div className="bg-slate-800/60 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader title="Negotiation Checklist" className="mb-0 border-0 pb-0" />
          <span className="text-xs bg-blue-900/50 border border-blue-700 text-blue-300 rounded px-2 py-0.5 font-mono">
            {doneCount}/{checkItems.length} done
          </span>
        </div>
        <div className="space-y-2">
          {checkItems.map((item) => (
            <label
              key={item.key}
              className="flex items-start gap-3 cursor-pointer group"
              onClick={() => setCheck(item.key)}
            >
              <div className={`flex-shrink-0 w-4 h-4 mt-0.5 border rounded flex items-center justify-center transition-colors
                ${checklist[item.key] ? 'bg-green-600 border-green-500' : 'border-slate-500 group-hover:border-blue-500'}`}
              >
                {checklist[item.key] && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                    <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className={`text-sm ${checklist[item.key] ? 'line-through text-slate-500' : 'text-slate-300 group-hover:text-slate-100'}`}>
                {item.label}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
