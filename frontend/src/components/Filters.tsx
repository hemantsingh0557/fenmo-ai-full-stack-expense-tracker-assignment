import { CATEGORIES, type Category } from "../schemas";

export type FiltersState = {
  category?: Category;
  sort: "date_desc" | "date_asc";
};

export function Filters({
  value,
  onChange,
}: {
  value: FiltersState;
  onChange: (next: FiltersState) => void;
}) {
  return (
    <div className="filters">
      <label className="field inline">
        <span>Category</span>
        <select
          value={value.category ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              category: (e.target.value || undefined) as Category | undefined,
            })
          }
        >
          <option value="">All</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="field inline">
        <span>Sort</span>
        <select
          value={value.sort}
          onChange={(e) =>
            onChange({
              ...value,
              sort: e.target.value as FiltersState["sort"],
            })
          }
        >
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
        </select>
      </label>
    </div>
  );
}
