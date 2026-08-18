# kaKeiBo 家計簿

A local, single-screen kakeibo ledger. FastAPI + SQLite on the back, a Remix SPA
on the front. No accounts, no auth, no network — the whole ledger is one SQLite
file on your disk.

Kakeibo (家計簿, "household financial ledger") is a Japanese budgeting method
from 1904. Its defining moves, all of which this app implements literally:

- **Savings come off the top.** Income − fixed costs − savings goal = the only
  money the month is allowed to spend.
- **Four buckets, split by intent** rather than by merchant — the same coffee is
  a Need or a Want depending on why you bought it.
  | | | |
  |---|---|---|
  | 必要 **Needs** | survival | groceries, transport, medicine, bills |
  | 欲求 **Wants** | optional pleasure | eating out, shopping, entertainment |
  | 文化 **Culture** | self-enrichment | books, courses, museums, music |
  | 予期せぬ **Unexpected** | surprises | repairs, medical bills, gifts |
- **The month closes on four questions.** How much do I have? How much would I
  like to save? How much am I actually spending? How can I improve? The app
  answers all four from your entries.

---

## Requirements

| | |
|---|---|
| Python | 3.10 or newer |
| Node | **20 or newer** |

> ⚠️ This machine currently has **Node v16.20.2**. Remix 2 and Vite 5 will not
> install or build on it. Install Node 20 first, e.g. with
> [nvm](https://github.com/nvm-sh/nvm):
> ```bash
> nvm install 20 && nvm use 20
> ```
> The Python side has no such constraint and runs as-is.

## Setup

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8004
```

The SQLite file is created on first boot at `backend/kakeibo.db`. There is
nothing to migrate and no fixtures to load.

- API docs: <http://127.0.0.1:8004/docs>
- Health check: <http://127.0.0.1:8004/api/health>

### 2. Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The dev server proxies `/api` to `http://127.0.0.1:8004`, so run both together.
Override the target with `KAKEIBO_API=http://host:port npm run dev`.

### 3. One-process mode (optional)

Build the SPA and FastAPI will serve it alongside the API — a single port, no
Node process at runtime:

```bash
cd frontend && npm run build     # → frontend/build/client
cd ../backend && uvicorn app.main:app --port 8004
```

Then open <http://127.0.0.1:8004>.

## Configuration

Every value is optional; copy `backend/.env.example` if you want to change any.

| Variable | Default | Purpose |
|---|---|---|
| `KAKEIBO_DB` | `backend/kakeibo.db` | Where the ledger lives |
| `KAKEIBO_CURRENCY` | `₹` | Symbol shown throughout |
| `KAKEIBO_LOCALE` | `en-IN` | Number grouping (lakh/crore for `en-IN`) |
| `KAKEIBO_CORS_ORIGINS` | localhost:5173, :3000 | Dev origins allowed to call the API |
| `KAKEIBO_FRONTEND_DIST` | `frontend/build/client` | Built SPA to serve |

## What the screen shows

One page, scoped by a single month filter at the top — every number and chart
below re-renders against that month.

| Section | What it answers |
|---|---|
| **Hero + tiles** | What is left to spend, at what daily rate, projected month-end, savings so far |
| **Budget meter** | Share of budget used, with a marker for where an even pace would put you today |
| **Where it went over / pulled back / patterns** | Written verdicts: which categories rose or fell vs last month, leaks, weekly and weekday patterns |
| **Where the money went** | The four buckets with share, entry counts, and month-over-month deltas |
| **Day by day** | A column per day, with the daily allowance drawn as a threshold |
| **Running total against pace** | Cumulative spend vs an even pace vs the budget ceiling |
| **Week by week** | Stacked bars per calendar week + the full numeric table, each week against its pro-rated share of the budget |
| **Day of the week** | Which weekday actually costs the most |
| **Recent months** | Twelve months of totals; click one to jump to it |
| **Plan / Ledger / Four questions** | Set the month up, log entries, close the month |

A month in progress is compared against **the same stretch** of the previous
month, never against a finished one.

## API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/dashboard?month=YYYY-MM` | Everything the screen needs, in one payload |
| `GET` | `/api/months` | Months that hold data, for the picker |
| `GET` | `/api/expenses?month=YYYY-MM` | Raw entries |
| `POST` | `/api/expenses` | Add an entry |
| `PUT` | `/api/expenses/{id}` | Edit an entry |
| `DELETE` | `/api/expenses/{id}` | Remove an entry |
| `GET` `PUT` | `/api/months/{month}/plan` | Income, fixed costs, savings goal, reflection |
| `GET` | `/api/health` | Status, db path, categories |

## Layout

```
backend/
  app/
    main.py         FastAPI app; serves the built SPA when present
    config.py       Env-driven settings
    db.py           SQLite connection per request (WAL, foreign keys on)
    schema.sql      Two tables: month_plan, expense
    models.py       Pydantic shapes + the four categories
    repository.py   Every SQL statement
    analytics.py    The kakeibo brain — budget maths, rollups, written insights
    routers/        dashboard.py, expenses.py, months.py
frontend/
  app/
    routes/_index.tsx   The single screen; clientLoader + clientAction
    components/         Charts, panels, ledger, forms
    lib/                Types, formatters, API client
    styles/app.css      Design tokens (light + dark) and layout
```

All analysis happens in `analytics.py`, so the UI stays a rendering layer. If
you want to change what counts as a "leak", how weeks are bucketed, or which
verdicts get written, that is the only file to open.

## Notes on the visuals

- The four category colours are a fixed, validated categorical palette —
  adjacent colourblind separation ΔE 9.1 (light) / 8.4 (dark), normal-vision
  22.9 / 19.8. Colour follows the **bucket**, never its rank, so a category
  keeps its hue whatever the month looks like.
- Two of the light-mode hues sit under 3:1 against the surface, so every chart
  using them ships visible labels and a table view — no value is reachable only
  by hovering. The daily and pace charts have a **Table** toggle; the weekly
  table is always on.
- Dark mode is a selected set of steps for the dark surface, not an inverted
  light palette. It follows your OS by default and the toggle overrides it.
- Charts are hand-rolled SVG. No charting library, no external requests.
