import { z } from "zod";

export const CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Health",
  "Entertainment",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

const amountInput = z.union([z.string(), z.number()]);

// catches rollovers like 2026-02-31 (JS Date silently turns it into 2026-03-03)
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
  .refine(
    (s) => {
      const d = new Date(s + "T00:00:00Z");
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
    },
    { message: "date is not a real calendar date" }
  );

export const CreateExpenseSchema = z.object({
  amount: amountInput,
  category: z.enum(CATEGORIES),
  description: z.string().max(500).optional().default(""),
  date: isoDate,
});

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;

export const ListExpensesQuerySchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  sort: z.enum(["date_desc", "date_asc"]).optional().default("date_desc"),
});

export type ListExpensesQuery = z.infer<typeof ListExpensesQuerySchema>;
