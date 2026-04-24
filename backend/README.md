# Backend

Node + Express + TypeScript + SQLite (`better-sqlite3`) + zod.

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Server runs on `http://localhost:4000`.

## Routes

Routes are mounted at both the root (matching the assignment spec) and under `/api` (conventional alias):

- `GET  /health`   and  `GET  /api/health`   — liveness probe
- `POST /expenses` and  `POST /api/expenses` — create expense
- `GET  /expenses` and  `GET  /api/expenses` — list with optional `category` filter and `sort=date_desc | date_asc`

`POST` accepts an optional `Idempotency-Key` header. When present, the server dedupes retries with the same key; when absent, each call creates a new row. The frontend always sends one.

## Scripts

- `npm run dev` — watch mode
- `npm run build` — compile to `dist/`
- `npm start` — run compiled build
- `npm test` — run test suite
