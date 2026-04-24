export function formatRupees(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;
  const rupeesStr = rupees.toLocaleString("en-IN");
  return `${sign}₹${rupeesStr}.${rem.toString().padStart(2, "0")}`;
}
