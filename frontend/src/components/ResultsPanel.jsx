/* eslint-disable react/prop-types */

// ── Formatting helpers ──────────────────────────────────────────
function fmtCost(v) {
  if (v == null) return '–';
  if (v < 0.01) return `$${v.toFixed(5)}`;
  if (v < 1)    return `$${v.toFixed(4)}`;
  if (v < 100)  return `$${v.toFixed(3)}`;
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(v, digits = 1) {
  if (v == null) return '–';
  const s = v.toFixed(digits);
  return `${v >= 0 ? '+' : ''}${s}%`;
}

function fmtNum(v, digits = 1) {
  if (v == null) return '–';
  return v.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

// ── Main component ──────────────────────────────────────────────
export default function ResultsPanel({ results, loading }) {
  if (loading) {
    return (
      <div className="results-panel">
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <h2>Calculating...</h2>
          <p>Running cost, pricing, risk, and sensitivity engines</p>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="results-panel">
        <div className="empty-state">
          <div className="empty-icon">⚙️</div>
          <h2>RFQ Analysis Ready</h2>
          <p>Enter injection molding parameters and click Calculate RFQ to get your complete decision package</p>
          <div className="empty-hints">
            <div className="empty-hint">
              <div className="hint-num">1</div>
              <span>Enter parameters</span>
            </div>
            <div className="empty-hint">
              <div className="hint-num">2</div>
              <span>Calculate RFQ</span>
            </div>
            <div className="empty-hint">
              <div className="hint-num">3</div>
              <span>See GO / NO GO</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { costs, pricing, risk, decision, sensitivity, recommendations, rfq_name, customer, part_number } = results;

  return (
    <div className="results-panel">

      {/* ── Decision Banner ───────────────────────────────────── */}
      <DecisionBanner decision={decision} risk={risk} rfq_name={rfq_name} customer={customer} part_number={part_number} />

      {/* ── Cost + Pricing ─────────────────────────────────────── */}
      <div className="row-2">
        <CostBreakdownCard costs={costs} />
        <PricingCard pricing={pricing} />
      </div>

      {/* ── Sensitivity ───────────────────────────────────────── */}
      <SensitivityCard sensitivity={sensitivity} />

      {/* ── Recommendations ───────────────────────────────────── */}
      <RecommendationsCard recommendations={recommendations} />
    </div>
  );
}

// ── Decision Banner ─────────────────────────────────────────────
function DecisionBanner({ decision, risk, rfq_name, customer, part_number }) {
  const isGo = decision.decision === 'GO';

  return (
    <div className={`decision-banner ${isGo ? 'go' : 'nogo'}`}>
      <div className="decision-left">
        <div className="decision-verdict">
          <div className="decision-label">Decision</div>
          <div className="decision-text">{decision.decision}</div>
        </div>
        <div className="decision-divider" />
        <div className="decision-metrics">
          <div className="decision-metric">
            <div className="metric-label">Margin (aggressive)</div>
            <div className="metric-value">{decision.margin_at_aggressive_pct.toFixed(1)}%</div>
          </div>
          <div className="decision-metric">
            <div className="metric-label">Margin (target)</div>
            <div className="metric-value">{decision.margin_at_target_pct.toFixed(1)}%</div>
          </div>
          {(customer || part_number || rfq_name) && (
            <div className="decision-metric">
              <div className="metric-label">{customer || rfq_name}</div>
              <div className="metric-value" style={{ fontSize: '13px', fontFamily: 'inherit' }}>
                {part_number || rfq_name}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="decision-risk">
        <span className="risk-pill">Risk: {risk.level}</span>
        <span className="risk-score">Score {risk.score} · {risk.factors.length} factor{risk.factors.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Reasons + Alerts below */}
      {(decision.reasons.length > 0 || decision.alerts.length > 0) && (
        <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '12px', marginTop: '4px' }}>
          <div className="decision-reasons">
            {decision.reasons.map((r, i) => (
              <div key={i} className="reason-item">
                <span>{isGo ? '✓' : '✗'}</span>
                <span>{r}</span>
              </div>
            ))}
            {decision.alerts.map((a, i) => (
              <div key={i} className="alert-item">
                <span>⚠</span>
                <span>{a}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Cost Breakdown Card ─────────────────────────────────────────
function CostBreakdownCard({ costs }) {
  const total = costs.total_cost_per_part;

  const rows = [
    { label: 'Machine', value: costs.machine_cost_per_part, color: '#2563eb' },
    { label: 'Material', value: costs.material_cost_per_part, color: '#16a34a' },
    { label: 'Labor', value: costs.labor_cost_per_part, color: '#d97706' },
    { label: 'Energy', value: costs.energy_cost_per_part, color: '#7c3aed' },
    { label: 'Tool Amort.', value: costs.tool_amortization_per_part, color: '#0891b2' },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Cost Breakdown</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--navy-800)' }}>
          {fmtCost(total)} / part
        </span>
      </div>
      <div className="card-body">
        <table className="cost-table">
          <tbody>
            {rows.map(({ label, value, color }) => {
              const pct = total > 0 ? (value / total) * 100 : 0;
              return (
                <tr key={label}>
                  <td className="cost-label">{label}</td>
                  <td className="cost-bar-cell">
                    <div className="cost-bar-bg">
                      <div
                        className="cost-bar-fill"
                        style={{ width: `${Math.min(pct, 100)}%`, background: color }}
                      />
                    </div>
                  </td>
                  <td className="cost-pct">{pct.toFixed(0)}%</td>
                  <td className="cost-value">{fmtCost(value)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="cost-total-row">
              <td className="cost-total-label" colSpan={3}>Total Cost / Part</td>
              <td className="cost-total-value">{fmtCost(total)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="throughput-row">
          <div className="throughput-item">
            <div className="throughput-label">Eff. Cycle Time</div>
            <div className="throughput-value">
              {fmtNum(costs.effective_cycle_time, 1)}
              <span className="throughput-unit"> s</span>
            </div>
          </div>
          <div className="throughput-item">
            <div className="throughput-label">Parts / Hour</div>
            <div className="throughput-value">
              {fmtNum(costs.parts_per_hour, 0)}
              <span className="throughput-unit"> pcs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pricing Card ────────────────────────────────────────────────
function PricingCard({ pricing }) {
  const levels = [
    {
      key: 'walk_away',
      data: pricing.walk_away,
      cls: 'walk-away',
      icon: '🚫',
    },
    {
      key: 'aggressive',
      data: pricing.aggressive,
      cls: 'aggressive',
      icon: '🎯',
      recommended: true,
    },
    {
      key: 'target',
      data: pricing.target,
      cls: 'target',
      icon: '⭐',
    },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Pricing Strategy</span>
      </div>
      <div className="card-body">
        <div className="pricing-cards">
          {levels.map(({ key, data, cls, recommended }) => (
            <div key={key} className={`price-card ${cls}`}>
              {recommended && <span className="recommended-tag">RFQ Bid</span>}
              <div className="price-card-header">
                <span className="price-tier-label">{data.label}</span>
                <span className="price-margin-badge">{data.margin_pct.toFixed(0)}% margin</span>
              </div>
              <div className="price-value">{fmtCost(data.price)}</div>
              <div className="price-desc">{data.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sensitivity Table ───────────────────────────────────────────
function SensitivityCard({ sensitivity }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Sensitivity Analysis</span>
        <span style={{ fontSize: '11px', color: 'var(--gray-400)' }}>
          Margin computed at fixed aggressive bid price
        </span>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        <table className="sensitivity-table">
          <thead>
            <tr>
              <th>Parameter / Scenario</th>
              <th>New Cost/Part</th>
              <th>Cost Δ</th>
              <th>Margin Δ</th>
              <th>Impact</th>
            </tr>
          </thead>
          <tbody>
            {sensitivity.map((s, i) => {
              const costUp = s.cost_delta > 0;
              const marginUp = s.margin_delta_pct > 0;
              return (
                <tr key={i}>
                  <td>
                    <div className="sens-param">{s.parameter}</div>
                    <div className="sens-desc">{s.change_description}</div>
                  </td>
                  <td className="sens-cost flat">{fmtCost(s.new_cost_per_part)}</td>
                  <td>
                    <span className={`sens-cost ${costUp ? 'up' : 'down'}`}>
                      {costUp ? '▲' : '▼'} {fmtCost(Math.abs(s.cost_delta))}
                      <span style={{ fontSize: '10px', marginLeft: '4px' }}>
                        ({Math.abs(s.cost_delta_pct).toFixed(1)}%)
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className={`sens-margin ${marginUp ? 'positive' : 'negative'}`}>
                      {marginUp ? '+' : ''}{s.margin_delta_pct.toFixed(1)} pp
                    </span>
                  </td>
                  <td>
                    <span className={`impact-badge ${s.impact_level}`}>
                      {s.impact_level}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Recommendations ─────────────────────────────────────────────
function RecommendationsCard({ recommendations }) {
  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Improvement Recommendations</span>
        <span style={{ fontSize: '11px', color: 'var(--gray-400)' }}>
          Prioritized by savings impact
        </span>
      </div>
      <div className="card-body">
        <div className="rec-list">
          {recommendations.map((rec) => (
            <div key={rec.priority} className={`rec-card priority-${rec.priority}`}>
              <div className="rec-priority">{rec.priority}</div>
              <div className="rec-content">
                <div className="rec-cat-badge">{rec.category.replace('_', ' ')}</div>
                <div className="rec-header">
                  <div className="rec-title">{rec.title}</div>
                  <div className="rec-savings">
                    <span className="savings-badge">Save {fmtCost(rec.expected_savings)}/part</span>
                    <span className="margin-badge">+{rec.margin_improvement_pct.toFixed(1)} pp margin</span>
                    <span className={`impact-badge ${rec.impact}`}>{rec.impact}</span>
                  </div>
                </div>
                <div className="rec-action">{rec.action}</div>
                <div className="rec-rationale">{rec.rationale}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
