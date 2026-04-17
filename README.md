# Automotive Injection Molding RFQ System

Production-ready MVP for automotive injection molding RFQ quoting, cost calculation, and GO/NO GO decision support.

## Features

| Engine | Description |
|--------|-------------|
| **Cost Calculation** | Precise per-part breakdown: machine, material, labor, energy, tooling |
| **3-Tier Pricing** | Walk-away (5%), aggressive RFQ (9%), target (15%) |
| **Risk Assessment** | LOW / MEDIUM / HIGH based on OEE, scrap rate, volume |
| **GO / NO GO Decision** | Automatic margin-protection logic with reason codes |
| **Sensitivity Analysis** | 6 scenarios showing cost and margin impact |
| **Recommendation Engine** | Top 5 prioritized actions to improve margin |

## Tech Stack

- **Backend**: Python 3.11+ · FastAPI · SQLAlchemy · SQLite (PostgreSQL-ready)
- **Frontend**: React 18 · Vite · Plain CSS (no dependencies)
- **API**: REST · OpenAPI/Swagger auto-docs

---

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend runs at: http://localhost:8000  
Swagger API docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: http://localhost:5173

---

## Example Input Data

| Parameter | Example | Notes |
|-----------|---------|-------|
| Cycle Time | 45 s | Per shot |
| Cavities | 2 | Number of cavities |
| OEE | 82 % | Industry avg ~75-85% |
| Material Price | $2.80/kg | PA6-GF30 typical |
| Shot Weight | 0.085 kg | Per part (not shot total) |
| Scrap Rate | 3 % | Reject rate |
| Annual Volume | 250,000 parts | Program volume |
| Tool Cost | $85,000 | Amortized over 1 year |
| Machine Rate | $45/hr | 300-500t press typical |
| Labor Cost | $28/hr | Direct labor |
| Energy Cost | $8/hr | Machine energy |

### Expected Output (example above)

- **Total Cost/Part**: ~$0.0413
- **Aggressive RFQ Price**: ~$0.0454
- **Decision**: GO
- **Risk**: MEDIUM

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/rfq/calculate` | Full RFQ analysis |
| `POST` | `/api/v1/quotes/` | Save a quote to DB |
| `GET` | `/api/v1/quotes/` | List all saved quotes |
| `GET` | `/api/v1/quotes/{id}` | Get specific quote |
| `GET` | `/health` | Health check |
| `GET` | `/docs` | Swagger UI |

---

## Business Logic

### Cost Formula

```
effective_cycle_time = cycle_time / (OEE / 100)
parts_per_hour       = (3600 / effective_cycle_time) × cavities

machine_cost    = machine_hourly_rate / parts_per_hour
material_cost   = (shot_weight × material_price) / (1 - scrap_rate/100)
labor_cost      = labor_cost_per_hour / parts_per_hour
energy_cost     = energy_cost_per_hour / parts_per_hour
tool_amort      = tool_cost / annual_volume

total_cost      = sum of all above
```

### Pricing Strategy

```
walk_away  = total_cost / (1 - 0.05)   → 5% margin floor
aggressive = total_cost / (1 - 0.09)   → 9% margin (competitive bid)
target     = total_cost / (1 - 0.15)   → 15% margin (open negotiation)
```

### NO GO Triggers

- Margin at aggressive price < 5%
- HIGH risk with margin < 10%

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in the values.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | No | SQLite by default; set PostgreSQL URL for production |
| `GEMINI_API_KEY` | For AI tab | Google Gemini key — get one free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | No | Override model (default: `gemini-2.5-flash`) |
| `ALLOWED_ORIGINS` | No | Comma-separated frontend origins for CORS (default: `http://localhost:5173`) |

```bash
# backend/.env
DATABASE_URL=sqlite:///./rfq.db
GEMINI_API_KEY=your_key_here
```

For Vercel / Railway deployments add the same variables in the dashboard under **Settings → Environment Variables**.

---

## PostgreSQL Migration

1. Install: `pip install psycopg2-binary`
2. Set environment variable:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/rfq_db
```

3. Remove SQLite-specific `connect_args` in `database.py` (already handled by env check)

---

## Project Structure

```
automotive-rfq/
├── README.md
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py          ← FastAPI app, CORS, router registration
│       ├── database.py      ← SQLAlchemy engine, session
│       ├── models.py        ← Quote DB model
│       ├── schemas/
│       │   └── rfq.py       ← All Pydantic schemas
│       ├── services/
│       │   ├── calculation.py    ← Core cost engine
│       │   ├── pricing.py        ← 3-tier pricing
│       │   ├── risk.py           ← Risk scoring
│       │   ├── decision.py       ← GO/NO GO logic
│       │   ├── sensitivity.py    ← 6-scenario analysis
│       │   └── recommendations.py ← Improvement actions
│       └── routers/
│           ├── rfq.py       ← POST /calculate endpoint
│           └── quotes.py    ← Quote CRUD endpoints
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.jsx          ← Main layout + state
        ├── App.css          ← Complete design system
        ├── api/
        │   └── client.js    ← fetch wrappers
        └── components/
            ├── InputPanel.jsx    ← Form (left)
            └── ResultsPanel.jsx  ← Dashboard (right)
```
