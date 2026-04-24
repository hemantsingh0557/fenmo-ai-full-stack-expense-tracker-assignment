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

- `GET  /health` — liveness probe
- `POST /expenses` — create expense (requires `Idempotency-Key` header)
- `GET  /expenses?category=Food&sort=date_desc` — list + filter + sort

## Scripts

- `npm run dev` — watch mode
- `npm run build` — compile to `dist/`
- `npm start` — run compiled build
- `npm test` — run test suite
