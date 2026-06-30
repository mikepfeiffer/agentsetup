import { test } from "node:test";
import assert from "node:assert/strict";
import { Ledger } from "../src/ledger.js";

test("charge records a new charge", () => {
  const ledger = new Ledger();
  const result = ledger.charge({ requestId: "req-1", amountCents: 500 });
  assert.equal(result.status, "charged");
  assert.equal(result.amountCents, 500);
  assert.equal(ledger.total(), 500);
  assert.equal(ledger.count(), 1);
});

test("charge is idempotent by requestId (no double-charge on retry)", () => {
  const ledger = new Ledger();
  ledger.charge({ requestId: "req-1", amountCents: 500 });
  const retry = ledger.charge({ requestId: "req-1", amountCents: 500 });
  assert.equal(retry.status, "duplicate");
  assert.equal(ledger.total(), 500);
  assert.equal(ledger.count(), 1);
});

test("charge rejects an idempotency conflict (same id, different amount)", () => {
  const ledger = new Ledger();
  ledger.charge({ requestId: "req-1", amountCents: 500 });
  assert.throws(
    () => ledger.charge({ requestId: "req-1", amountCents: 999 }),
    /idempotency conflict/
  );
});

test("charge validates input at the edge", () => {
  const ledger = new Ledger();
  assert.throws(() => ledger.charge({ requestId: "", amountCents: 1 }), TypeError);
  assert.throws(() => ledger.charge({ requestId: "x", amountCents: 1.5 }), TypeError);
});
