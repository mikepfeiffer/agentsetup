import { test } from "node:test";
import assert from "node:assert/strict";
import { addCents, assertAmount, formatCents, isValidAmount } from "../src/money.js";

test("isValidAmount accepts only non-negative integers", () => {
  assert.equal(isValidAmount(0), true);
  assert.equal(isValidAmount(150), true);
  assert.equal(isValidAmount(1.5), false);
  assert.equal(isValidAmount(-1), false);
  assert.equal(isValidAmount("100"), false);
});

test("assertAmount rejects floats (money must be integer minor units)", () => {
  assert.throws(() => assertAmount(9.99), TypeError);
});

test("addCents adds integer amounts", () => {
  assert.equal(addCents(199, 1), 200);
});

test("formatCents renders major.minor", () => {
  assert.equal(formatCents(0), "USD 0.00");
  assert.equal(formatCents(5), "USD 0.05");
  assert.equal(formatCents(1234), "USD 12.34");
  assert.equal(formatCents(1000, "EUR"), "EUR 10.00");
});
