import express from "express";
import cors from "cors";
import { openDb } from "./db";
import { errorHandler } from "./errors";
import { expensesRouter } from "./routes/expenses";

export function createApp(dbPath?: string): express.Express {
  const app = express();
  const db = openDb(dbPath);
  app.locals.db = db;

  // CORS_ORIGIN:
  //   unset or "*"  -> allow all (good for curl + easy testing)
  //   "a,b,c"       -> allow-list of origins (split, trim, array)
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
      endpoints: ["/api/health", "/api/expenses"],
    });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api", expensesRouter());

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
