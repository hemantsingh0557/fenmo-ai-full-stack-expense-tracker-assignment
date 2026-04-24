import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createExpense,
  listExpenses,
  type CreatePayload,
  type ListFilters,
} from "./api";

export function useExpenses(filters: ListFilters) {
  return useQuery({
    queryKey: ["expenses", filters],
    queryFn: ({ signal }) => listExpenses(filters, signal),
    staleTime: 10_000,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      payload,
      idempotencyKey,
    }: {
      payload: CreatePayload;
      idempotencyKey: string;
    }) => createExpense(payload, idempotencyKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
}
