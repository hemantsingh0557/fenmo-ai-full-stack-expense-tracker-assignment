import express from "express";
import cors from "cors";
import { openDb } from "./db";
import { errorHandler } from "./errors";
import { expensesRouter } from "./routes/expenses";

export function createApp(dbPath?: string): express.Express {
  const app = express();
  const db = openDb(dbPath);
  app.locals.db = db;

  const raw = process.env.CORS_ORIGIN?.trim();
  const corsOrigin: string | string[] =
    !raw || raw === "*"
      ? "*"
      : raw.split(",").map((s) => s.trim()).filter(Boolean);

  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: "10kb" }));

  app.get("/", (_req, res) => {
    res.json({
      status: "working",
      service: "expense-tracker-api",
      endpoints: ["/health", "/expenses", "/api/health", "/api/expenses"],
    });
  });

  const health: express.RequestHandler = (_req, res) => {
    res.json({ ok: true });
  };
  app.get("/health", health);
  app.get("/api/health", health);

  // assignment spec uses /expenses; /api/expenses is the conventional alias.
  const router = expensesRouter();
  app.use(router);
  app.use("/api", router);

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
