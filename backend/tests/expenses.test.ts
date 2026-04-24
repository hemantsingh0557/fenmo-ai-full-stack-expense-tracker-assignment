import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/index";

function app() {
  return createApp(":memory:");
}

describe("POST /expenses", () => {
  it("creates an expense and stores amount as integer paise", async () => {
    const res = await request(app())
      .post("/api/expenses")
      .set("Idempotency-Key", "k-create-1")
      .send({
        amount: "99.50",
        category: "Food",
        description: "breakfast",
        date: "2026-04-24",
      });

    expect(res.status).toBe(201);
    expect(res.body.amount).toBe("99.50");
    expect(res.body.amount_paise).toBe(9950);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("dedupes retries with the same Idempotency-Key", async () => {
    const server = app();
    const payload = {
      amount: "42.00",
      category: "Food",
      description: "x",
      date: "2026-04-24",
    };

    const first = await request(server)
      .post("/api/expenses")
      .set("Idempotency-Key", "retry-same")
      .send(payload);

    // second call with same key but a DIFFERENT payload should still
    // return the original row — the key is the contract, not the body.
    const second = await request(server)
      .post("/api/expenses")
      .set("Idempotency-Key", "retry-same")
      .send({ ...payload, amount: "9999.00", description: "changed" });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body).toEqual(first.body);

    // and the list only has one row
    const list = await request(server).get("/api/expenses");
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].id).toBe(first.body.id);
  });

  it("rejects a negative amount", async () => {
    const res = await request(app())
      .post("/api/expenses")
      .set("Idempotency-Key", "neg-1")
      .send({
        amount: "-50",
        category: "Food",
        description: "",
        date: "2026-04-24",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.amount).toBeDefined();
  });

  it("rejects an amount with more than 2 decimal places", async () => {
    const res = await request(app())
      .post("/api/expenses")
      .set("Idempotency-Key", "dec-1")
      .send({
        amount: "1.234",
        category: "Food",
        description: "",
        date: "2026-04-24",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.amount).toBeDefined();
  });

  it("requires a date", async () => {
    const res = await request(app())
      .post("/api/expenses")
      .set("Idempotency-Key", "nodate-1")
      .send({ amount: "50", category: "Food", description: "" });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.date).toBeDefined();
  });

  it("rejects a rollover date like 2026-02-31", async () => {
    const res = await request(app())
      .post("/api/expenses")
      .set("Idempotency-Key", "roll-1")
      .send({
        amount: "50",
        category: "Food",
        description: "",
        date: "2026-02-31",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.date).toBeDefined();
  });

  it("accepts both /expenses and /api/expenses", async () => {
    const server = app();

    const a = await request(server)
      .post("/expenses")
      .set("Idempotency-Key", "dual-a")
      .send({
        amount: "10",
        category: "Food",
        description: "root",
        date: "2026-04-24",
      });
    expect(a.status).toBe(201);

    const b = await request(server)
      .post("/api/expenses")
      .set("Idempotency-Key", "dual-b")
      .send({
        amount: "20",
        category: "Food",
        description: "prefixed",
        date: "2026-04-24",
      });
    expect(b.status).toBe(201);

    const fromRoot = await request(server).get("/expenses");
    const fromApi = await request(server).get("/api/expenses");
    expect(fromRoot.body.count).toBe(2);
    expect(fromApi.body.count).toBe(2);
  });

  it("rejects an unknown category", async () => {
    const res = await request(app())
      .post("/api/expenses")
      .set("Idempotency-Key", "cat-1")
      .send({
        amount: "50",
        category: "NotAThing",
        description: "",
        date: "2026-04-24",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.fields.category).toBeDefined();
  });
});

describe("GET /expenses", () => {
  it("filters by category and returns the filtered total", async () => {
    const server = app();

    const rows = [
      { amount: "100.00", category: "Food", date: "2026-04-20" },
      { amount: "50.00", category: "Food", date: "2026-04-22" },
      { amount: "200.00", category: "Transport", date: "2026-04-21" },
    ];
    for (let i = 0; i < rows.length; i++) {
      await request(server)
        .post("/api/expenses")
        .set("Idempotency-Key", `seed-${i}`)
        .send({ ...rows[i], description: "" });
    }

    const all = await request(server).get("/api/expenses");
    expect(all.body.count).toBe(3);
    expect(all.body.total_paise).toBe(35000);

    const food = await request(server).get("/api/expenses?category=Food");
    expect(food.body.count).toBe(2);
    expect(food.body.total_paise).toBe(15000);
    expect(food.body.total).toBe("150.00");
  });

  it("sorts newest first by default", async () => {
    const server = app();

    await request(server)
      .post("/api/expenses")
      .set("Idempotency-Key", "s-old")
      .send({
        amount: "10",
        category: "Food",
        description: "",
        date: "2026-01-01",
      });
    await request(server)
      .post("/api/expenses")
      .set("Idempotency-Key", "s-new")
      .send({
        amount: "10",
        category: "Food",
        description: "",
        date: "2026-04-01",
      });

    const res = await request(server).get("/api/expenses");
    expect(res.body.items[0].date).toBe("2026-04-01");
    expect(res.body.items[1].date).toBe("2026-01-01");
  });
});
