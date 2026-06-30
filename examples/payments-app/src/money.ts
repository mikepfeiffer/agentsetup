// Money helpers. Amounts are ALWAYS integers in the currency's smallest unit
// (e.g. cents). Never use floats for money — see this module's AGENTS.md.

export type Cents = number;

/** True only for a non-negative integer number of minor units. */
export function isValidAmount(amount: unknown): amount is Cents {
  return typeof amount === "number" && Number.isInteger(amount) && amount >= 0;
}

/** Returns the amount if valid, otherwise throws. Use at every input edge. */
export function assertAmount(amount: unknown): Cents {
  if (!isValidAmount(amount)) {
    throw new TypeError(
      `amount must be a non-negative integer number of cents, got: ${String(amount)}`
    );
  }
  return amount;
}

/** Adds two cent amounts, validating both. */
export function addCents(a: Cents, b: Cents): Cents {
  return assertAmount(a) + assertAmount(b);
}

/** Formats cents as "CUR major.minor", e.g. formatCents(1234) -> "USD 12.34". */
export function formatCents(amount: Cents, currency = "USD"): string {
  assertAmount(amount);
  const major = Math.floor(amount / 100);
  const minor = (amount % 100).toString().padStart(2, "0");
  return `${currency} ${major}.${minor}`;
}
