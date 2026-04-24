import { useEffect, useState } from "react";
import { ExpenseForm } from "./components/ExpenseForm";
import { Filters, type FiltersState } from "./components/Filters";
import { ExpenseList } from "./components/ExpenseList";
import { TotalBar } from "./components/TotalBar";
import { useExpenses } from "./hooks";
import { CATEGORIES, type Category } from "./schemas";

function readFiltersFromUrl(): FiltersState {
  const q = new URLSearchParams(window.location.search);
  const c = q.get("category") ?? "";
  const s = q.get("sort") ?? "date_desc";
  const category = (CATEGORIES as readonly string[]).includes(c)
    ? (c as Category)
    : undefined;
  const sort = s === "date_asc" ? "date_asc" : "date_desc";
  return { category, sort };
}

function writeFiltersToUrl(f: FiltersState) {
  const q = new URLSearchParams();
  if (f.category) q.set("category", f.category);
  if (f.sort !== "date_desc") q.set("sort", f.sort);
  const qs = q.toString();
  const url = window.location.pathname + (qs ? `?${qs}` : "");
  window.history.replaceState(null, "", url);
}

export default function App() {
  const [filters, setFilters] = useState<FiltersState>(() =>
    readFiltersFromUrl()
  );

  useEffect(() => {
    writeFiltersToUrl(filters);
  }, [filters]);

  const query = useExpenses({
    category: filters.category,
    sort: filters.sort,
  });

  const items = query.data?.items ?? [];
  const totalPaise = query.data?.total_paise ?? 0;
  const count = query.data?.count ?? items.length;

  return (
    <div className="container">
      <header className="header">
        <h1>Expense Tracker</h1>
        <p className="muted">
          small personal-finance tool. all amounts in rupees.
        </p>
      </header>

      <ExpenseForm />

      <div className="listSection">
        <Filters value={filters} onChange={setFilters} />
        <TotalBar count={count} totalPaise={totalPaise} />
        <ExpenseList
          items={items}
          isLoading={query.isLoading || query.isFetching}
          error={query.error as Error | null}
          onRetry={() => query.refetch()}
        />
      </div>
    </div>
  );
}
