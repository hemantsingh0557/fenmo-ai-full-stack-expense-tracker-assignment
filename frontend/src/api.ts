import type { Category } from "./schemas";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export type Expense = {
  id: string;
  amount: string;
  amount_paise: number;
  category: Category;
  description: string;
  date: string;
  created_at: string;
};

export type ListResponse = {
  items: Expense[];
  total_paise: number;
  total: string;
  count: number;
};

export type ApiErrorShape = {
  code: string;
  message: string;
  fields?: Record<string, string>;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public payload: ApiErrorShape
  ) {
    super(payload.message);
  }
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { error?: ApiErrorShape };
    if (body?.error) return new ApiError(res.status, body.error);
  } catch {
    // fall through
  }
  return new ApiError(res.status, {
    code: "unknown",
    message: `request failed (${res.status})`,
  });
}

export type ListFilters = {
  category?: Category;
  sort?: "date_desc" | "date_asc";
};

export async function listExpenses(
  filters: ListFilters,
  signal?: AbortSignal
): Promise<ListResponse> {
  const qs = new URLSearchParams();
  if (filters.category) qs.set("category", filters.category);
  if (filters.sort) qs.set("sort", filters.sort);
  const url = `${API_BASE}/expenses${qs.size ? `?${qs}` : ""}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as ListResponse;
}

export type CreatePayload = {
  amount: string;
  category: Category;
  description: string;
  date: string;
};

export async function createExpense(
  payload: CreatePayload,
  idempotencyKey: string
): Promise<Expense> {
  const res = await fetch(`${API_BASE}/expenses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as Expense;
}
