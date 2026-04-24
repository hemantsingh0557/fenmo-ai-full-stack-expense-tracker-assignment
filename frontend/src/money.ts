// display-side money helpers. backend is the source of truth; this is only
// for formatting what the server sends us.

export function formatRupees(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;
  const rupeesStr = rupees.toLocaleString("en-IN");
  return `${sign}₹${rupeesStr}.${rem.toString().padStart(2, "0")}`;
}
