import { useState } from 'react';

const DEFAULTS = {
  rfq_name: 'RFQ-2024-001',
  customer: '',
  part_number: '',
  // Production
  cycle_time: 45,
  cavities: 2,
  oee: 82,
  // Material
  material_price_per_kg: 2.8,
  shot_weight: 0.085,
  scrap_rate: 3,
  // Business
  annual_volume: 250000,
  tool_cost: 85000,
  machine_hourly_rate: 45,
  labor_cost_per_hour: 28,
  energy_cost_per_hour: 8,
};

export default function InputPanel({ onCalculate, loading, error }) {
  const [values, setValues] = useState(DEFAULTS);

  function set(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function handleChange(e) {
    const { name, value, type } = e.target;
    set(name, type === 'number' ? (value === '' ? '' : Number(value)) : value);
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Convert empty strings to 0 before submission
    const payload = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v === '' ? 0 : v])
    );
    onCalculate(payload);
  }

  function handleReset() {
    setValues(DEFAULTS);
  }

  return (
    <form className="input-panel" onSubmit={handleSubmit} noValidate>

      {/* ── Identity ─────────────────────────────────────────── */}
      <div className="input-section">
        <div className="section-header identity">
          <span className="section-dot identity" />
          RFQ Identity
        </div>
        <div className="section-fields">
          <Field
            label="RFQ Name"
            name="rfq_name"
            type="text"
            value={values.rfq_name}
            onChange={handleChange}
            placeholder="e.g. RFQ-2024-001"
          />
          <Field
            label="Customer"
            name="customer"
            type="text"
            value={values.customer}
            onChange={handleChange}
            placeholder="Customer name"
          />
          <Field
            label="Part Number"
            name="part_number"
            type="text"
            value={values.part_number}
            onChange={handleChange}
            placeholder="P/N"
          />
        </div>
      </div>

      {/* ── Production ───────────────────────────────────────── */}
      <div className="input-section">
        <div className="section-header production">
          <span className="section-dot production" />
          Production
        </div>
        <div className="section-fields">
          <Field
            label="Cycle Time"
            name="cycle_time"
            unit="sec"
            value={values.cycle_time}
            onChange={handleChange}
            step="0.1"
            min="1"
            max="600"
          />
          <Field
            label="Cavities"
            name="cavities"
            unit="cav"
            value={values.cavities}
            onChange={handleChange}
            step="1"
            min="1"
            max="64"
          />
          <Field
            label="OEE"
            name="oee"
            unit="%"
            value={values.oee}
            onChange={handleChange}
            step="0.5"
            min="1"
            max="99.9"
          />
        </div>
      </div>

      {/* ── Material ─────────────────────────────────────────── */}
      <div className="input-section">
        <div className="section-header material">
          <span className="section-dot material" />
          Material
        </div>
        <div className="section-fields">
          <Field
            label="Material Price"
            name="material_price_per_kg"
            unit="$/kg"
            value={values.material_price_per_kg}
            onChange={handleChange}
            step="0.01"
            min="0.01"
          />
          <Field
            label="Shot Weight (per part)"
            name="shot_weight"
            unit="kg"
            value={values.shot_weight}
            onChange={handleChange}
            step="0.001"
            min="0.001"
          />
          <Field
            label="Scrap Rate"
            name="scrap_rate"
            unit="%"
            value={values.scrap_rate}
            onChange={handleChange}
            step="0.1"
            min="0"
            max="49"
          />
        </div>
      </div>

      {/* ── Business ─────────────────────────────────────────── */}
      <div className="input-section">
        <div className="section-header business">
          <span className="section-dot business" />
          Business
        </div>
        <div className="section-fields">
          <Field
            label="Annual Volume"
            name="annual_volume"
            unit="parts/yr"
            value={values.annual_volume}
            onChange={handleChange}
            step="1000"
            min="1"
          />
          <Field
            label="Tool Cost"
            name="tool_cost"
            unit="$"
            value={values.tool_cost}
            onChange={handleChange}
            step="500"
            min="0"
          />
          <Field
            label="Machine Rate"
            name="machine_hourly_rate"
            unit="$/hr"
            value={values.machine_hourly_rate}
            onChange={handleChange}
            step="1"
            min="1"
          />
          <Field
            label="Labor Cost"
            name="labor_cost_per_hour"
            unit="$/hr"
            value={values.labor_cost_per_hour}
            onChange={handleChange}
            step="1"
            min="0"
          />
          <Field
            label="Energy Cost"
            name="energy_cost_per_hour"
            unit="$/hr"
            value={values.energy_cost_per_hour}
            onChange={handleChange}
            step="0.5"
            min="0"
          />
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="btn-group">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading && <span className="spinner" />}
          {loading ? 'Calculating...' : 'Calculate RFQ'}
        </button>
        <button type="button" className="btn-secondary" onClick={handleReset} disabled={loading}>
          Reset
        </button>
      </div>
    </form>
  );
}

/* ── Field component ──────────────────────────────────────────── */
function Field({ label, name, unit, value, onChange, type = 'number', placeholder, ...rest }) {
  return (
    <div className="field">
      <label htmlFor={name} className="field-label">{label}</label>
      <div className="field-row">
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`field-input${unit ? '' : ' no-unit'}`}
          {...rest}
        />
        {unit && <span className="field-unit">{unit}</span>}
      </div>
    </div>
  );
}
