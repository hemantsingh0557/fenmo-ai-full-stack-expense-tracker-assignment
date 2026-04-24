import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export type DB = Database.Database;

export function openDb(dbPath?: string): DB {
  const target =
    dbPath ?? process.env.DB_PATH ?? path.join(process.cwd(), "expenses.db");

  if (target !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
  }

  const db = new Database(target);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  migrate(db);
  return db;
}

function migrate(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0),
      category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (key, method, path)
    );
  `);
}
