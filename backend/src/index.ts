import express from "express";
import cors from "cors";
import { openDb } from "./db";
import { errorHandler } from "./errors";
import { expensesRouter } from "./routes/expenses";

export function createApp(dbPath?: string): express.Express {
  const app = express();
  const db = openDb(dbPath);
  app.locals.db = db;

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()) ?? "*",
    })
  );
  app.use(express.json({ limit: "10kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use(expensesRouter());

  app.use(errorHandler);
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 4000);
  const app = createApp();
  app.listen(port, () => {
    console.log(`api listening on :${port}`);
  });
}
