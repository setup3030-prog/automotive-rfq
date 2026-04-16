# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Injection molding RFQ (Request for Quote) quoting tool for the automotive industry. Given ~70 input parameters (cycle time, material, tooling, labor, logistics, etc.), it computes a full cost breakdown, 3-tier pricing strategy, risk score, GO/NO GO decision, sensitivity analysis, and negotiation support. The frontend runs all calculations client-side in real time; the backend provides persistence and an independent calculation API.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript 5.5, Vite 5, Tailwind CSS 3, Recharts |
| Backend | FastAPI (Python 3.11+), SQLAlchemy 2, Pydantic, SQLite (dev) / PostgreSQL (prod) |
| State | React Context + `useReducer` + `useMemo` — no external state library |
| Persistence | `localStorage` (frontend state + quote history), SQLite/PostgreSQL (backend) |

## Key Directories

```
frontend/src/
  context/RfqContext.tsx     — single source of truth: state, reducer, computed pipeline
  types/rfq.ts               — all TypeScript interfaces (RfqInput, CostModelResult, etc.)
  calculations/              — pure calculation functions mirroring backend logic
  components/tabs/           — 8 tab views (Dashboard, RfqInput, CostModel, …)
  components/ui/             — shared widgets; *Calculator.tsx = modal assistants
  utils/storage.ts           — localStorage read/write + quote snapshot history
  api/client.js              — fetch wrapper for backend endpoints

backend/app/
  services/                  — domain logic: calculation, pricing, risk, decision, sensitivity
  routers/rfq.py             — POST /api/v1/rfq/calculate
  routers/quotes.py          — CRUD /api/v1/quotes/
  schemas/rfq.py             — Pydantic request/response models
```

## Commands

### Frontend
```bash
cd frontend
npm install
npm run dev          # dev server → http://localhost:5173
npm run build        # tsc + vite build (production)
npm run typecheck    # tsc --noEmit — run this before committing
```

### Backend
```bash
cd backend
python -m venv venv && venv\Scripts\activate   # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# Swagger UI → http://localhost:8000/docs
```

### One-click (Windows)
```bash
start.bat   # launches both servers + opens http://localhost:5173
```

## State & Calculation Pipeline

All state lives in [frontend/src/context/RfqContext.tsx](frontend/src/context/RfqContext.tsx). The `RfqState` holds: `input` (70 fields), `priceMargins`, `competitiveness`, `scenarios` (best/realistic/worst), `checklist`, `activeTab`.

Computed results are derived reactively via `useMemo` in the order: `costModel → priceStrategy → competitiveness → scenarios → sensitivity`. Every tab reads from `useRfq()` and dispatches actions; none hold local calculation logic.

Full dispatch action types: `SET_INPUT`, `SET_MARGINS`, `SET_COMPETITIVENESS`, `SET_SCENARIO`, `SET_CHECKLIST`, `SET_TAB`, `LOAD_STATE`, `RESET` — see [RfqContext.tsx:109-117](frontend/src/context/RfqContext.tsx#L109-L117).

State auto-persists to `localStorage` key `rfq-quoting-tool-v2` on every dispatch. Quote snapshots (max 10) use key `rfq-quote-history-v1` — see [utils/storage.ts:3-5](frontend/src/utils/storage.ts#L3-L5).

## Calculation Rules

The cost model applies two hard guards before any calculation:
- OEE is capped at 0.90 — [costModel.ts:6](frontend/src/calculations/costModel.ts#L6)
- Scrap rate is floored at 0.02 — [costModel.ts:7](frontend/src/calculations/costModel.ts#L7)

The backend mirrors the same formulas in [backend/app/services/calculation.py](backend/app/services/calculation.py). When modifying a formula, update **both** the frontend `calculations/` module and the corresponding backend service.

## Adding a New Section Calculator (Modal Pattern)

The modal calculator pattern (used for sections 2.4, 2.5, 2.7, 2.9) follows a fixed structure:
1. Create `frontend/src/components/ui/XyzCalculator.tsx` — modal with `onClose` prop, internal state, `handleApply` dispatches `SET_INPUT`
2. Add `showXyzCalc` state + modal render in [RfqInput.tsx](frontend/src/components/tabs/RfqInput.tsx)
3. Add `⚡ Calculate` button to the section header using the same flex layout as sections 2.4/2.5

See [.claude/docs/architectural_patterns.md](.claude/docs/architectural_patterns.md) for the full pattern reference.

## Backend API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/rfq/calculate` | Full RFQ analysis (no persistence) |
| `POST` | `/api/v1/quotes/` | Calculate + save to DB |
| `GET` | `/api/v1/quotes/` | List saved quotes |
| `GET/DELETE` | `/api/v1/quotes/{id}` | Single quote |

CORS is configured in [backend/app/main.py:28-37](backend/app/main.py#L28-L37) — add new origins there.

## Additional Documentation

| File | When to read |
|---|---|
| [.claude/docs/architectural_patterns.md](.claude/docs/architectural_patterns.md) | Adding modals, new calc modules, new tabs, backend service logic |
| [README.md](README.md) | Business formulas, complete API reference, PostgreSQL migration |
| [frontend/src/types/rfq.ts](frontend/src/types/rfq.ts) | All data shapes — consult before touching any interface |
| [backend/app/schemas/rfq.py](backend/app/schemas/rfq.py) | Backend Pydantic models — keep in sync with frontend types |
