# Architectural Patterns

Patterns that appear in multiple files across this codebase.

---

## 1. Context + Reducer + Computed Pipeline

**Files:** `RfqContext.tsx`, all `tabs/*.tsx`, all `calculations/*.ts`

All application state flows through a single context. Components never compute derived values — they only read from `computed` and dispatch actions.

```
RfqState (useReducer)
  └─► useMemo pipeline (RfqContext.tsx:160+)
        costModel → priceStrategy → competitiveness → scenarios → sensitivity
  └─► useRfq() hook exposes { state, dispatch, computed }
```

**Convention:** Every tab imports `useRfq()` at the top, destructures what it needs, and calls `dispatch({ type: 'SET_INPUT', payload })` for any field change. Tabs never own calculation logic.

---

## 2. Calculation Module Pattern

**Files:** `calculations/costModel.ts`, `calculations/priceStrategy.ts`, `calculations/competitiveness.ts`, `calculations/scenarios.ts`, `calculations/sensitivity.ts`

Every calculation module:
- Exports a single pure function: `calcXyz(inp: RfqInput, ...): XyzResult`
- Accepts typed input from `types/rfq.ts`
- Returns a fully typed result object
- Uses `safe()` / `safeDiv()` from `utils/formatters.ts` for zero-division safety
- Applies reality guards at the top before any formula — see [costModel.ts:5-16](../../frontend/src/calculations/costModel.ts#L5-L16)

**Adding a new calculation:** create `calculations/newModule.ts`, add the result type to `types/rfq.ts`, add to the `useMemo` pipeline in `RfqContext.tsx`, expose on the `ComputedResults` interface.

---

## 3. Modal Calculator Pattern

**Files:** `ui/LogisticsCalculator.tsx`, `ui/MachineCalculator.tsx`, `ui/EnergyLaborCalculator.tsx`, `ui/OverheadCalculator.tsx`

Every calculator modal follows the same structure:

```
Props: { onClose: () => void }
  ├── Local state: inputs for the calculator's sub-fields
  ├── Derived values: computed inline (no useMemo — these are simple arithmetic)
  ├── handleApply(): dispatch({ type: 'SET_INPUT', payload: { field: value } })
  └── Render: fixed overlay → modal box → sticky header (with ✕) → scrollable body
        ├── SectionBox components (one per calculation group)
        ├── ResultRow components (breakdown display)
        ├── Checkbox grid for selective field application
        └── "Apply to RFQ" button (disabled when nothing checked)
```

**Key detail:** Apply checkboxes default to `true` for primary outputs (e.g., energyPrice), `false` for secondary outputs (e.g., operatorsPerMachine). This lets users apply only the fields they want.

**Wiring in RfqInput.tsx:**
- Add `const [showXyzCalc, setShowXyzCalc] = useState(false)` at the top
- Render `{showXyzCalc && <XyzCalculator onClose={() => setShowXyzCalc(false)} />}` above the section div
- Replace `<SectionHeader title="2.x …" />` with a flex div containing the title + `⚡ Calculate` button

---

## 4. Section Form Pattern

**Files:** all `components/tabs/RfqInput.tsx` sections

Each RFQ input section is a `bg-slate-800/60 rounded-lg p-4` div containing:
- A header (either `<SectionHeader>` for static sections, or a flex row with title + Calculate button for sections with a calculator)
- A `grid grid-cols-N gap-4` of `<InputField>` / `<SelectField>` components
- Fields bind directly: `value={inp.fieldName}` → `onChange={(v) => set({ fieldName: transform(v) })}`

The `set()` helper (local to `RfqInput`) merges partial input: `dispatch({ type: 'SET_INPUT', payload })`.

---

## 5. Reality Guards Pattern

**Files:** `calculations/costModel.ts`, `components/tabs/RfqInput.tsx`

Guards appear in two places:
1. **Calculation layer** — hard clamps applied silently before formulas run: `oeeUsed = Math.min(inp.oee, 0.90)`, `scrapUsed = Math.max(inp.scrapRate, 0.02)`
2. **UI layer** — `guards` object computed inside `RfqInput` drives yellow warning banners

When adding a new guarded field: add the clamp in `costModel.ts` first, then surface the warning in the `guards` block in `RfqInput.tsx`.

---

## 6. LocalStorage Persistence Pattern

**Files:** `utils/storage.ts`, `context/RfqContext.tsx`

- **State persistence:** every `useReducer` dispatch triggers `saveToStorage(nextState)` via `useEffect`; `loadFromStorage()` seeds initial state on mount
- **Quote snapshots:** `saveSnapshot(name, state)` stores up to 10 quotes under `rfq-quote-history-v1`; the `QuoteHistory` modal lists and restores them via `LOAD_STATE` dispatch
- **JSON import/export:** `exportJson(state)` / `importJson(file)` in `utils/storage.ts` used by the header buttons in `RfqInput.tsx`

---

## 7. Backend Service Pipeline

**Files:** `backend/app/routers/rfq.py`, `backend/app/services/*.py`

The backend calculation pipeline is orchestrated in the router, not in a service. Each service is a standalone pure function:

```
POST /api/v1/rfq/calculate
  └── schemas.RFQInput (Pydantic validates)
        ├── calculation.calculate_costs(input) → CostBreakdown
        ├── pricing.calculate_pricing(costs)   → PricingResult
        ├── risk.calculate_risk(input)          → RiskResult
        ├── decision.make_decision(risk, pricing) → DecisionResult
        ├── sensitivity.calculate_sensitivity(input) → [SensitivityScenario]
        └── recommendations.generate_recommendations(input, costs) → [Recommendation]
```

**Margin tiers (backend):** walk-away 5%, aggressive 9%, target 15% — hardcoded in `pricing.py`. Frontend uses configurable `priceMargins` from state (defaults: 15/20/22%).

---

## 8. Tab Registration Pattern

**Files:** `App.tsx`, `types/rfq.ts`

Adding a new top-level tab requires changes in three places:
1. Add the `TabId` union type in [types/rfq.ts](../../frontend/src/types/rfq.ts)
2. Add entry to the `TABS` array in [App.tsx:15-24](../../frontend/src/App.tsx#L15-L24)
3. Add a `case` to `TabContent` switch in [App.tsx:26-37](../../frontend/src/App.tsx#L26-L37)
