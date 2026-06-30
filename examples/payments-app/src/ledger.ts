import { assertAmount, type Cents } from "./money.js";

export interface ChargeRequest {
  /** Idempotency key. Retries MUST reuse the same id. */
  requestId: string;
  amountCents: Cents;
}

export interface ChargeResult {
  requestId: string;
  amountCents: Cents;
  status: "charged" | "duplicate";
}

/**
 * An in-memory charge ledger that records charges idempotently.
 *
 * Retrying a charge with the same `requestId` must NOT double-charge: it returns
 * the original result marked `duplicate`. A retry that reuses an id but changes
 * the amount is a bug on the caller's side and is rejected as a conflict.
 */
export class Ledger {
  #charges = new Map<string, Cents>();

  charge(request: ChargeRequest): ChargeResult {
    const { requestId } = request;
    if (typeof requestId !== "string" || requestId.length === 0) {
      throw new TypeError("requestId must be a non-empty string");
    }
    const amountCents = assertAmount(request.amountCents);

    const existing = this.#charges.get(requestId);
    if (existing !== undefined) {
      if (existing !== amountCents) {
        throw new Error(
          `idempotency conflict for requestId "${requestId}": ` +
            `already charged ${existing}, got ${amountCents}`
        );
      }
      return { requestId, amountCents: existing, status: "duplicate" };
    }

    this.#charges.set(requestId, amountCents);
    return { requestId, amountCents, status: "charged" };
  }

  /** Sum of all recorded charges, in cents. */
  total(): Cents {
    let sum = 0;
    for (const amount of this.#charges.values()) sum += amount;
    return sum;
  }

  /** Number of distinct charges recorded. */
  count(): number {
    return this.#charges.size;
  }
}
