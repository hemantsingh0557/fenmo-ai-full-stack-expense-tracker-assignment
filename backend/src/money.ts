// money lives as integer paise in the db. never as a float.
// 1 rupee = 100 paise.
//
// parsing via string split avoids the classic float trap:
//   1.1 * 100 = 110.00000000000001
// we refuse to guess; more than 2 decimal places is a user error.

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

export function parseAmountToPaise(input: unknown): number {
  if (input === null || input === undefined || input === "") {
    throw new MoneyError("amount is required");
  }

  const str = String(input).trim();

  if (!/^\d+(\.\d{1,2})?$/.test(str)) {
    throw new MoneyError(
      "amount must be a non-negative number with up to 2 decimal places"
    );
  }

  const [rupeesPart, paisePart = ""] = str.split(".");
  const rupees = parseInt(rupeesPart, 10);
  const paise = parseInt(paisePart.padEnd(2, "0"), 10);

  const total = rupees * 100 + paise;

  if (!Number.isSafeInteger(total)) {
    throw new MoneyError("amount is too large");
  }

  return total;
}

export function paiseToRupeeString(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${sign}${rupees}.${rem.toString().padStart(2, "0")}`;
}

export function formatRupees(paise: number): string {
  return `₹${paiseToRupeeString(paise)}`;
}
