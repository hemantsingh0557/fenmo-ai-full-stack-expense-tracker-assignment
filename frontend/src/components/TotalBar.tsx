import { formatRupees } from "../money";

export function TotalBar({
  count,
  totalPaise,
}: {
  count: number;
  totalPaise: number;
}) {
  return (
    <div className="totalBar">
      <span className="muted">
        {count} {count === 1 ? "expense" : "expenses"}
      </span>
      <span className="total">Total: {formatRupees(totalPaise)}</span>
    </div>
  );
}
