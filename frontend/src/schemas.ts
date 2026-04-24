// mirrors backend/src/schemas.ts — a shared package is the real fix, timeboxed so duplicated.
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

export const CreateExpenseFormSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, "amount is required")
    .regex(
      /^\d+(\.\d{1,2})?$/,
      "must be a non-negative number with up to 2 decimals"
    ),
  category: z.enum(CATEGORIES, { message: "pick a category" }),
  description: z.string().max(500).optional().default(""),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date is required"),
});

export type CreateExpenseFormInput = z.infer<typeof CreateExpenseFormSchema>;
