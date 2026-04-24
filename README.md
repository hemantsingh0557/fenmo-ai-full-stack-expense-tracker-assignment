# Expense Tracker

Small full-stack personal-finance tool. Backend API + web UI for logging expenses, filtering them by category, sorting by date, and seeing a running total.

## Live

- Frontend: _coming after deploy_
- Backend: _coming after deploy_

## Stack

- **Backend:** Node 20, Express, TypeScript, SQLite (`better-sqlite3`), zod
- **Frontend:** React 18, Vite, TypeScript, TanStack Query
- **Tests:** vitest + supertest on the backend

## Run locally

Requires Node 20+.

```bash
# terminal 1
cd backend
npm install
cp .env.example .env
npm run dev          # http://localhost:4000

# terminal 2
cd frontend
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

Run backend tests:

```bash
cd backend && npm test
```

## API

| Method | Path         | Notes                                                |
|--------|--------------|------------------------------------------------------|
| GET    | `/health`    | liveness                                             |
| POST   | `/expenses`  | create. accepts `Idempotency-Key` header (see below) |
| GET    | `/expenses`  | query: `category`, `sort=date_desc \| date_asc`     |

Create request body:

```json
{ "amount": "123.45", "category": "Food", "description": "lunch", "date": "2026-04-24" }
```

List response:

```json
{
  "items": [{ "id": "...", "amount": "123.45", "amount_paise": 12345, ... }],
  "total_paise": 12345,
  "total": "123.45",
  "count": 1
}
```

Errors always have the shape `{ "error": { "code", "message", "fields?": { ... } } }`.

## Key design decisions

### Money is stored as integer paise, never floats

Rupees come in as strings (`"123.45"`), are split on the dot, and converted to an integer number of paise (`12345`). Floats are never used for arithmetic. Reason: `1.1 * 100 === 110.00000000000001` is a real trap that silently corrupts totals over time. Three-or-more-decimal amounts are rejected as a validation error rather than silently rounded.

Display formatting happens only at the edge (the React `formatRupees` helper). The server also returns a pre-formatted `total` so clients don't need to know the rounding rule.

### Idempotent POST via `Idempotency-Key` header

The assignment calls out retries + browser refreshes as first-class concerns. The frontend generates a UUID per form-submission attempt and sends it as `Idempotency-Key`. If the same key hits the server twice — rapid double-click, refresh mid-request, TanStack Query auto-retry — the server returns the **original** response instead of inserting again.

Implementation:

- `idempotency_keys` table with primary key `(key, method, path)` stores status + response body.
- The expense insert and the idempotency-key insert happen inside one SQLite transaction, so either both succeed or neither does.
- On the unique-constraint race (two concurrent requests with the same key), the loser re-reads the stored response and returns it.

The header is **optional** on the wire — clients that don't send one still work, they just don't get dedupe. The frontend always sends one.

### SQLite for persistence

- Zero setup: one file, `expenses.db`, created on first boot.
- Real ACID semantics for the transaction above.
- WAL mode for safer concurrent reads.

Trade-off: the deploy target needs a persistent disk (Render has one). On a filesystem-less platform like Vercel serverless, I'd swap to Postgres — the code path through `better-sqlite3` is thin so this would be a few hours of work, not a rewrite.

### Server computes the total

The `total_paise` / `total` in `GET /expenses` is computed with `SUM(amount_paise)` in the same query as the list, so filter + total are always consistent and there's no client-side rounding drift.

### Filter + sort state lives in the URL

Refreshing the page preserves the current view. Achieved with `URLSearchParams` + `history.replaceState`; no router needed for a single-page tool.

## Trade-offs (chosen because of the timebox)

- **Fixed category list** (Food, Transport, Shopping, Bills, Health, Entertainment, Other) instead of user-manageable categories. Adding CRUD for categories is straightforward but out of scope.
- **zod schemas duplicated** between `backend/src/schemas.ts` and `frontend/src/schemas.ts`. The honest fix is a shared workspace package; for a small assignment that's over-engineering.
- **No pagination.** The list is a single query. At realistic personal-finance scale (thousands of rows) this is fine; at millions it isn't.
- **Minimal styling.** The prompt said "keep styling simple; focus on correctness and clarity."
- **CORS locked to one origin** (via `CORS_ORIGIN` env var), not a dynamic allow-list.

## Intentionally not done

- Auth / multi-user. Out of scope for this exercise.
- Edit / delete. Not in the acceptance criteria.
- Currency selection. `₹` is hardcoded.
- Category summary / charts. Listed as nice-to-have; skipped in favour of a stronger idempotency story, which is the harder correctness problem.
- Docker / CI. A `package.json` script works; Docker is deployment-target-specific and Render handles it natively.
- Optimistic UI updates. The mutation invalidates the list query on success instead. Simpler and less surprising when the server rejects a request.

## What's tested

Backend (`cd backend && npm test`):

1. POST creates an expense and stores the amount as integer paise.
2. Same `Idempotency-Key` + different payload → still returns the original row. Only one row exists.
3. Negative amount rejected.
4. Amount with > 2 decimals rejected.
5. Missing date rejected.
6. Unknown category rejected.
7. GET filters by category and the returned total matches the filtered rows.
8. GET sorts newest-first by default.

Frontend is manually tested against the live backend. In a longer timebox I'd add a Playwright test for the rapid-double-click scenario.

## Repo layout

```
backend/        Express API
frontend/       React UI
.gitignore
README.md       (this file)
```
