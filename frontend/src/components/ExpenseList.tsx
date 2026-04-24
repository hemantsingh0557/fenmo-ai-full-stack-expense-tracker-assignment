import type { Expense } from "../api";
import { formatRupees } from "../money";

export function ExpenseList({
  items,
  isLoading,
  error,
  onRetry,
}: {
  items: Expense[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  if (isLoading && items.length === 0) {
    return (
      <div className="card center muted">loading expenses…</div>
    );
  }

  if (error) {
    return (
      <div className="card center">
        <div className="err">couldn't load expenses</div>
        <button className="btn" onClick={onRetry}>
          retry
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card center muted">no expenses yet — add one above.</div>
    );
  }

  return (
    <div className="card list">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Description</th>
            <th className="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.id}>
              <td>{e.date}</td>
              <td>
                <span className="pill">{e.category}</span>
              </td>
              <td className="desc">{e.description || "—"}</td>
              <td className="right mono">{formatRupees(e.amount_paise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
