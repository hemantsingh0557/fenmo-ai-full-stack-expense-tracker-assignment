# Expense Tracker

Small full-stack personal-finance tool. Backend API + web UI for logging expenses, filtering them by category, sorting by date, and seeing a running total.

Built as a take-home assignment, but written like something you might maintain for real: money stored as integer paise, every POST is idempotent, validation on both sides, a real test suite.

---

## Live

| | URL |
|---|---|
| Frontend | https://fenmo-ai-full-stack-expense-tracker.vercel.app |
| Backend  | https://fenmo-ai-expense-tracker-api.onrender.com |
| Repo     | https://github.com/hemantsingh0557/fenmo-ai-full-stack-expense-tracker-assignment |

> **Heads-up — Render free tier:** the backend sleeps after ~15 min idle. First request after sleep may take 40–60 seconds to cold-start. Later requests are instant.

---

## Contents

- [Stack](#stack)
- [Run locally](#run-locally)
- [Backend](#backend)
  - [Project layout](#backend-project-layout)
  - [API reference](#api-reference)
  - [Data model](#data-model)
  - [Idempotency](#idempotency)
  - [Money handling](#money-handling)
  - [Error shape](#error-shape)
  - [Environment variables](#backend-environment-variables)
  - [Tests](#tests)
- [Frontend](#frontend)
  - [Project layout](#frontend-project-layout)
  - [Components](#components)
  - [State management](#state-management)
  - [Form + idempotency lifecycle](#form--idempotency-lifecycle)
  - [URL-persisted filters](#url-persisted-filters)
  - [Validation](#frontend-validation)
  - [Environment variables](#frontend-environment-variables)
- [Key design decisions](#key-design-decisions)
- [Trade-offs](#trade-offs-chosen-because-of-the-timebox)
- [Intentionally not done](#intentionally-not-done)
- [Deployment](#deployment)
- [What I'd do next](#what-id-do-next)

---

## Stack

| Layer    | Choice |
|----------|--------|
| Backend runtime | Node 20, TypeScript, Express 4 |
| Database        | SQLite via `better-sqlite3` (WAL mode) |
| Validation      | `zod` (same library used on the frontend) |
| Testing         | `vitest` + `supertest` |
| Frontend        | React 18, Vite, TypeScript |
| Data fetching   | `@tanstack/react-query` |
| Styling         | Plain CSS, no component library |

**Why these?** SQLite is the simplest persistence that still has real ACID — essential for the idempotency story. React-Query takes care of loading states, retries, and cache invalidation "for free," which is most of what "behaves correctly under realistic conditions" means in a frontend. zod is the one library shared between frontend and backend so validation rules can't drift.

---

## Run locally

Requires **Node 20+**. Two terminals:

```bash
# terminal 1 — backend
cd backend
npm install
cp .env.example .env
npm run dev              # http://localhost:4000
```

```bash
# terminal 2 — frontend
cd frontend
npm install
cp .env.example .env
npm run dev              # http://localhost:5173
```

Open http://localhost:5173.

---

# Backend

Express + TypeScript API. One file per concern, no controllers-services-repositories layering — it's 4 endpoints and doesn't need it.

## Backend project layout

```
backend/
├── src/
│   ├── index.ts            # express app factory + bootstrap
│   ├── db.ts               # sqlite open + migrations + WAL pragma
│   ├── schemas.ts          # zod schemas for request bodies + query params
│   ├── money.ts            # paise parsing + formatting (no floats)
│   ├── errors.ts           # HttpError class + express error handler
│   └── routes/
│       └── expenses.ts     # POST / GET handlers, idempotency logic
├── tests/
│   └── expenses.test.ts    # 8 tests: create, idempotency, validation, list
├── vitest.config.ts
├── tsconfig.json
└── package.json
```

Scripts:

- `npm run dev` — `tsx watch` for fast reload
- `npm run build` — emit `dist/`
- `npm start` — run the compiled build
- `npm test` — run the vitest suite

## API reference

Base URL: whatever `CORS_ORIGIN` points to the backend at. Locally: `http://localhost:4000`.

All responses are JSON. All error responses use the [shape below](#error-shape).

Routes are mounted at **both** the root (matching the assignment spec's `/expenses`) and under `/api` (conventional alias for a JSON API). Either prefix works. Examples below use `/api/...`; `/expenses`, `/health` work identically.

---

### `GET /`

Friendly root — useful for sanity-checking the bare backend URL in a browser.

**Response `200`**

```json
{
  "status": "working",
  "service": "expense-tracker-api",
  "endpoints": ["/health", "/expenses", "/api/health", "/api/expenses"]
}
```

---

### `GET /health` (also `GET /api/health`)

Liveness probe for the deploy platform.

**Response `200`**

```json
{ "ok": true }
```

---

### `POST /expenses` (also `POST /api/expenses`)

Create a new expense.

**Headers**

| Header | Required | Purpose |
|---|---|---|
| `Content-Type: application/json` | yes | |
| `Idempotency-Key: <uuid>` | **recommended** | If provided, retries with the same key return the original response instead of inserting a duplicate. See [Idempotency](#idempotency). |

**Request body**

| Field | Type | Rules |
|---|---|---|
| `amount` | string or number | non-negative, ≤ 2 decimal places. stored as integer paise. |
| `category` | string (enum) | one of `Food`, `Transport`, `Shopping`, `Bills`, `Health`, `Entertainment`, `Other` |
| `description` | string (optional) | ≤ 500 chars |
| `date` | string | `YYYY-MM-DD`, must be a real calendar date. `2026-02-31` is rejected as a validation error (not silently rolled over to March). |

**Example request**

```http
POST /api/expenses HTTP/1.1
Content-Type: application/json
Idempotency-Key: 89c5b3d7-9b4f-4a40-9b1e-2a1e9b4f3d0c

{ "amount": "123.45", "category": "Food", "description": "lunch", "date": "2026-04-24" }
```

**Response `201 Created`**

```json
{
  "id": "1508439a-a41b-4a5c-a3ac-e5a227951ae0",
  "amount": "123.45",
  "amount_paise": 12345,
  "category": "Food",
  "description": "lunch",
  "date": "2026-04-24",
  "created_at": "2026-04-24T14:10:23.637Z"
}
```

**Idempotent replay** — sending the same `Idempotency-Key` again (even with a different body) returns the **original** row with the same `id` and `201` status.

**Validation failure `400`**

```json
{
  "error": {
    "code": "validation_error",
    "message": "invalid request",
    "fields": { "date": "Required" }
  }
}
```

Money-specific failures return the same shape with `fields.amount`.

---

### `GET /expenses` (also `GET /api/expenses`)

List expenses. Supports filtering by category and sorting by date.

**Query parameters**

| Param | Values | Default |
|---|---|---|
| `category` | one of the enum values above | none (returns all) |
| `sort` | `date_desc` or `date_asc` | `date_desc` |

**Example**

```http
GET /api/expenses?category=Food&sort=date_desc
```

**Response `200`**

```json
{
  "items": [
    {
      "id": "1508439a-a41b-4a5c-a3ac-e5a227951ae0",
      "amount": "123.45",
      "amount_paise": 12345,
      "category": "Food",
      "description": "lunch",
      "date": "2026-04-24",
      "created_at": "2026-04-24T14:10:23.637Z"
    }
  ],
  "total_paise": 12345,
  "total": "123.45",
  "count": 1
}
```

The `total` is computed by the server in the same query pass as the filter, so it's always consistent with `items` — the UI doesn't have to re-sum and can't drift.

---

## Data model

SQLite schema, created idempotently on boot by `db.ts`:

```sql
CREATE TABLE expenses (
  id             TEXT    PRIMARY KEY,
  amount_paise   INTEGER NOT NULL CHECK (amount_paise >= 0),
  category       TEXT    NOT NULL,
  description    TEXT    NOT NULL DEFAULT '',
  date           TEXT    NOT NULL,            -- ISO YYYY-MM-DD
  created_at     TEXT    NOT NULL             -- ISO timestamp UTC
);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_date     ON expenses(date);

CREATE TABLE idempotency_keys (
  key            TEXT    NOT NULL,
  method         TEXT    NOT NULL,
  path           TEXT    NOT NULL,
  status_code    INTEGER NOT NULL,
  response_body  TEXT    NOT NULL,
  created_at     TEXT    NOT NULL,
  PRIMARY KEY (key, method, path)
);
```

- `amount_paise` is the source of truth for money. `amount` in API responses is the display-formatted rupees.
- `id` is a UUID v4 generated server-side.
- `created_at` is set server-side, not by the client, so clock skew can't break ordering within the same second.

## Idempotency

The assignment explicitly calls out retries, double-clicks, and refresh-mid-submit. The whole strategy:

1. **Client generates a UUID per submission attempt** and sends it as `Idempotency-Key`. The frontend rotates this UUID only after a successful create, so every retry of the *same* submission carries the *same* key.
2. **Server checks the table first.** If the key exists for this `(method, path)`, the stored response is returned directly — same status code, same body, same `id`.
3. **If not, the insert happens inside a single SQLite transaction** with the idempotency-key record. Either both rows land or neither does.
4. **On the race where two concurrent requests with the same key try to insert simultaneously**, the unique constraint on `(key, method, path)` makes the second transaction fail. The handler catches `SQLITE_CONSTRAINT_PRIMARYKEY`, re-reads the stored response, and returns it.

The header is optional — clients without it still get a 201 and a new row. The frontend always sends one. This is tested end-to-end in `tests/expenses.test.ts`.

## Money handling

Floats lie. `1.1 * 100 === 110.00000000000001`. At scale, float arithmetic corrupts totals silently. So money never touches a float in this codebase:

- Input is validated by regex: `^\d+(\.\d{1,2})?$`. A `1.234` amount is a **validation error**, not silently rounded.
- Conversion to paise is done by string split: `"123.45"` → `rupees=123`, `paise=45` → `12345`. No multiplication by 100.
- Storage is `INTEGER` (paise).
- Sums use `SUM(amount_paise)` in SQL.
- The one place a number gets divided is at the display edge (`formatRupees`).

See `src/money.ts`.

## Error shape

Every error response uses the same envelope:

```json
{
  "error": {
    "code": "validation_error",
    "message": "invalid request",
    "fields": { "amount": "amount must be a non-negative number with up to 2 decimal places" }
  }
}
```

| `code` | Status | When |
|---|---|---|
| `validation_error` | 400 | zod schema failure or money-parse failure |
| `bad_request`      | 400 | other client errors |
| `internal_error`   | 500 | anything uncaught (logged server-side) |

Zod path-to-field mapping is done in `errors.ts` so the UI can render errors inline per input.

## Backend environment variables

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | listen port |
| `DB_PATH` | `./expenses.db` | sqlite file location. set to `:memory:` in tests. on Render, point at a persistent disk mount like `/var/data/expenses.db`. |
| `CORS_ORIGIN` | `*` | comma-separated list of allowed origins. **set to the deployed frontend URL in production.** |
| `NODE_ENV` | — | `production` disables verbose logging |

## Tests

`cd backend && npm test`. Uses an in-memory SQLite DB (`:memory:`) so tests are hermetic and fast.

Coverage:

| # | What | Why |
|---|---|---|
| 1 | POST creates an expense, amount stored as integer paise | baseline correctness |
| 2 | **Same `Idempotency-Key` + different payload → same original row returned**, only one row in DB | the headline assignment concern |
| 3 | Negative amount → 400 | validation |
| 4 | Amount with > 2 decimals → 400 | money correctness |
| 5 | Missing date → 400 | validation |
| 6 | Unknown category → 400 | validation |
| 7 | GET with `?category=` returns filtered items AND filtered total matches | server-computed total stays consistent |
| 8 | GET sorts newest-first by default | ordering contract |
| 9 | Rollover date like `2026-02-31` is rejected | calendar validity, not just regex shape |
| 10 | Both `/expenses` and `/api/expenses` work | spec-path + conventional-prefix compatibility |

---

# Frontend

React single-page app. No router — it's one view. Filter state lives in the URL so refresh preserves the page.

## Frontend project layout

```
frontend/
├── src/
│   ├── main.tsx                   # entry, sets up QueryClient + StrictMode
│   ├── App.tsx                    # composes form + filters + list + total
│   ├── api.ts                     # fetch wrapper, typed responses, ApiError
│   ├── hooks.ts                   # useExpenses, useCreateExpense
│   ├── schemas.ts                 # zod schemas (mirror of backend)
│   ├── money.ts                   # display-only paise → ₹ formatter
│   ├── styles.css                 # small hand-rolled stylesheet
│   ├── vite-env.d.ts
│   └── components/
│       ├── ExpenseForm.tsx        # controlled form + idempotency key lifecycle
│       ├── ExpenseList.tsx        # table, empty / loading / error states
│       ├── Filters.tsx            # category dropdown + sort select
│       └── TotalBar.tsx           # "{count} expenses — Total: ₹X"
├── index.html
├── vite.config.ts
├── tsconfig*.json
└── package.json
```

Scripts:

- `npm run dev` — dev server with HMR on :5173
- `npm run build` — typecheck + production bundle to `dist/`
- `npm run preview` — serve the built bundle locally

## Components

| File | What it does |
|---|---|
| `App.tsx` | Reads initial filter state from URL, syncs changes back via `history.replaceState`. Queries the expense list. Passes data down. No business logic. |
| `components/ExpenseForm.tsx` | Controlled inputs for amount/category/description/date. Runs zod on submit. Owns the idempotency UUID. Displays inline field errors and a global API error banner. Disables the submit button during `isPending`. |
| `components/Filters.tsx` | Category select (`All` + 7 categories) and sort select (`Newest first` / `Oldest first`). Fully controlled; doesn't own state. |
| `components/ExpenseList.tsx` | Renders the table. Has three off-path states: loading skeleton (first load), error with a Retry button, and empty state. |
| `components/TotalBar.tsx` | Displays the server-computed total using `formatRupees`. |

## State management

- **Server data** → `@tanstack/react-query`. `useExpenses(filters)` is keyed on the filter object, so changing a filter is a new cache entry. `useCreateExpense` invalidates the `['expenses']` key on success — no manual list refreshes.
- **Form state** → plain `useState` per input. Four fields, no need for a form library.
- **Filter state** → `useState` in `App.tsx`, mirrored to `window.location.search` via `useEffect`.
- **Idempotency key** → `useRef` in the form, rotated on success.

React-Query defaults used:

- `retry: 2` on queries (so flaky networks recover without user action)
- `retry: 0` on mutations (because the idempotency key is what makes retries safe; we let the user decide whether to retry a create, rather than firing repeated POSTs silently)
- `refetchOnWindowFocus: false` (the list isn't collaborative, refetch-on-focus is just noise)

## Form + idempotency lifecycle

```
[mount form]
    │
    ▼
key = uuid()                       ← generated once per new submission
    │
    ▼
user types → zod-validates on submit
    │
    ▼
POST /expenses   ───► server inserts (key stored)
    │                      │
    │                      ▼
    ▼                  201 response
onSuccess:                 │
  - reset inputs           │
  - key = uuid()  ◄────────┘        ← rotate: next submit is a new request
```

If the POST fails midway — request aborted, server 500, network drop — the key is **not** rotated. The user can hit submit again and the server will either:

- see the retry before committing and complete it exactly once, or
- see the second attempt after the first committed and return the stored response.

Either way: no duplicate row.

## URL-persisted filters

The filter state (`?category=Food&sort=date_asc`) is written to the URL on every change. Refreshing the page keeps the view. The URL is also shareable.

- Only non-default values are written (`sort=date_desc` is omitted because it's the default).
- Unknown values in the URL are ignored rather than rejected (robustness: a user pasting a stale URL should still see something sensible).

## Frontend validation

Runs on submit, client-side, using the same zod rules as the backend (duplicated in `src/schemas.ts`). This means:

- Invalid submissions don't hit the network at all → no wasted round-trip on typos.
- When the server *does* reject something (e.g. future date logic if we added it), `err.payload.fields` is fed straight back into the per-input error state, so server-only rules still surface inline.

## Frontend environment variables

| Var | Default | Purpose |
|---|---|---|
| `VITE_API_BASE` | `http://localhost:4000` | where the API lives |

Baked into the bundle at build time; to change it on a deployed frontend you redeploy with a new value.

---

## Key design decisions

The decisions worth calling out, in order of "how much of the assignment is actually graded on this":

### 1. Integer paise everywhere

The money column is `INTEGER`, SQL sums it, parsing avoids float math. Any 3-decimal amount is rejected rather than silently rounded. This is the single thing most likely to cause silent production bugs if done wrong.

### 2. Idempotent POST

Described in full above. The headline property: the same `Idempotency-Key` with a **different body** still returns the original row. Tested.

### 3. Server-computed total

The `total_paise` is returned by the same endpoint as `items`, computed by SQL. Two reasons:

- It's consistent with the filter (never "total of filtered rows" vs "total of all rows" bug).
- It can't drift if the client's rounding differs from the server's. There is one source of truth.

### 4. zod on both sides

Same rules. Client validates before hitting the network (no wasted round-trips on typos). Server validates always (can't trust the client). The rules are duplicated rather than shared via a workspace package; see trade-offs.

### 5. SQLite with WAL

Zero-setup persistence that still has real ACID. WAL mode allows concurrent reads during writes. Trade-off is the deploy target needs a persistent disk.

### 6. TanStack Query over custom fetch

`useMutation` + `useQuery` handle loading states, retries, and cache invalidation with well-tested defaults. Rolling these by hand in `useState` is how bugs like "stale list after create" or "double fire on re-render" happen.

---

## Trade-offs (chosen because of the timebox)

- **Fixed category list.** A CRUD UI for categories was skipped in favour of a harder idempotency story.
- **Duplicated zod schemas** between `backend/src/schemas.ts` and `frontend/src/schemas.ts`. A shared workspace package is the right fix but a lot of ceremony for ~30 lines of schemas.
- **No pagination.** Single-query list. Fine for realistic personal-finance scale, not fine at millions of rows.
- **Minimal styling.** Dark theme, plain CSS, no component library. The prompt said "keep styling simple; focus on correctness and clarity."
- **Backend tests are integration-style.** They spin up the real Express app against an in-memory DB. This catches more bugs than unit tests but is slightly slower. For 8 tests it's instant; it wouldn't scale to hundreds.
- **Frontend is manually tested.** The most valuable test — rapid-double-click → one row — was more usefully written server-side, where the test proves the deduplication contract regardless of client.

---

## Intentionally not done

- **Auth / multi-user.** Out of scope.
- **Edit / delete.** Not in the acceptance criteria.
- **Currency selection.** `₹` is hardcoded.
- **Category summary view / charts.** Nice-to-have from the brief; skipped.
- **Recurring expenses, budgets, exports.** Product features, not evaluation targets.
- **Docker.** Node + npm scripts work on the deploy platforms chosen. Dockerfile would be platform-specific noise.
- **CI pipeline.** `npm test` runs locally; for a longer exercise I'd add a GitHub Actions workflow that runs it on push.
- **Optimistic UI updates.** `onSuccess` invalidates the list query instead. Simpler. Optimistic updates are a lot of code to get right in edge cases (conflict with validation errors, concurrent mutations) and the user-facing improvement for one-shot creates is small.
- **`PATCH` / `DELETE`.** Not required by the spec.

---

## Deployment

- **Backend:** Render, with a 1 GB persistent disk mounted at `/var/data`. The SQLite file lives there so it survives redeploys.
- **Frontend:** Vercel. Static Vite build, `VITE_API_BASE` pointing at the Render backend.
- **CORS:** Backend's `CORS_ORIGIN` is set to the Vercel URL. Not a dynamic allow-list.

See Render + Vercel configuration in their respective dashboards (no `render.yaml` committed — the free-tier disk is set up through the UI).

---

## What I'd do next

In rough order of value-per-hour:

1. **GitHub Actions CI** — run `npm test` and `npm run build` on push. Trivial to add, catches regressions.
2. **Shared workspace package** for zod schemas. A couple of hours, removes the single duplication risk.
3. **Playwright smoke test** for the double-click scenario end-to-end in a browser.
4. **Summary by category endpoint** (`GET /expenses/summary`) — server-side aggregation, small UI panel.
5. **Edit/delete.** API + UI buttons. Straightforward since the idempotency pattern generalises (DELETE isn't idempotent in the same way, but "already-deleted" is the same outcome).
6. **Move to Postgres.** If the app actually needed concurrent writers or horizontal scale, swap `better-sqlite3` for `pg` + a connection pool. The route handlers wouldn't change much; the `db.ts` layer absorbs it.
