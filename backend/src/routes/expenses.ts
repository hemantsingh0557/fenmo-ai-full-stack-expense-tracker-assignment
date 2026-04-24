import { Router, type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "crypto";
import type Database from "better-sqlite3";
import { CreateExpenseSchema, ListExpensesQuerySchema } from "../schemas";
import { parseAmountToPaise, paiseToRupeeString } from "../money";

type IdempotencyRow = { status_code: number; response_body: string };

type ExpenseRow = {
  id: string;
  amount_paise: number;
  category: string;
  description: string;
  date: string;
  created_at: string;
};

function shapeResponse(row: ExpenseRow) {
  return {
    id: row.id,
    amount: paiseToRupeeString(row.amount_paise),
    amount_paise: row.amount_paise,
    category: row.category,
    description: row.description,
    date: row.date,
    created_at: row.created_at,
  };
}

export function expensesRouter(): Router {
  const router = Router();

  router.post(
    "/expenses",
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const parsed = CreateExpenseSchema.parse(req.body);
        const amountPaise = parseAmountToPaise(parsed.amount);

        const db = req.app.locals.db as Database.Database;
        const idempotencyKey = req.header("Idempotency-Key")?.trim();
        const path = "/expenses";

        if (idempotencyKey) {
          const existing = db
            .prepare(
              "SELECT status_code, response_body FROM idempotency_keys WHERE key = ? AND method = ? AND path = ?"
            )
            .get(idempotencyKey, "POST", path) as IdempotencyRow | undefined;

          if (existing) {
            res
              .status(existing.status_code)
              .type("application/json")
              .send(existing.response_body);
            return;
          }
        }

        const row: ExpenseRow = {
          id: randomUUID(),
          amount_paise: amountPaise,
          category: parsed.category,
          description: parsed.description ?? "",
          date: parsed.date,
          created_at: new Date().toISOString(),
        };
        const body = shapeResponse(row);
        const serialised = JSON.stringify(body);

        const insertExpense = db.prepare(
          "INSERT INTO expenses (id, amount_paise, category, description, date, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        );
        const insertKey = db.prepare(
          "INSERT INTO idempotency_keys (key, method, path, status_code, response_body, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        );

        const runTx = db.transaction(() => {
          insertExpense.run(
            row.id,
            row.amount_paise,
            row.category,
            row.description,
            row.date,
            row.created_at
          );
          if (idempotencyKey) {
            insertKey.run(
              idempotencyKey,
              "POST",
              path,
              201,
              serialised,
              row.created_at
            );
          }
        });

        try {
          runTx();
        } catch (err: unknown) {
          // race: another request with the same key committed first.
          // read back the stored response and return it.
          const code = (err as { code?: string })?.code;
          if (
            idempotencyKey &&
            (code === "SQLITE_CONSTRAINT_PRIMARYKEY" ||
              code === "SQLITE_CONSTRAINT_UNIQUE")
          ) {
            const existing = db
              .prepare(
                "SELECT status_code, response_body FROM idempotency_keys WHERE key = ? AND method = ? AND path = ?"
              )
              .get(idempotencyKey, "POST", path) as
              | IdempotencyRow
              | undefined;
            if (existing) {
              res
                .status(existing.status_code)
                .type("application/json")
                .send(existing.response_body);
              return;
            }
          }
          throw err;
        }

        res.status(201).json(body);
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    "/expenses",
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const q = ListExpensesQuerySchema.parse(req.query);
        const db = req.app.locals.db as Database.Database;

        const whereParts: string[] = [];
        const params: unknown[] = [];
        if (q.category) {
          whereParts.push("category = ?");
          params.push(q.category);
        }
        const where = whereParts.length
          ? "WHERE " + whereParts.join(" AND ")
          : "";
        const order =
          q.sort === "date_asc"
            ? "date ASC, created_at ASC"
            : "date DESC, created_at DESC";

        const rows = db
          .prepare(
            `SELECT id, amount_paise, category, description, date, created_at
             FROM expenses ${where}
             ORDER BY ${order}`
          )
          .all(...params) as ExpenseRow[];

        const totalRow = db
          .prepare(
            `SELECT COALESCE(SUM(amount_paise), 0) AS total
             FROM expenses ${where}`
          )
          .get(...params) as { total: number };

        res.json({
          items: rows.map(shapeResponse),
          total_paise: totalRow.total,
          total: paiseToRupeeString(totalRow.total),
          count: rows.length,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
