# Payments — Agent Instructions

Inherits root `AGENTS.md`. Rules below are **payments-only** and would be wrong
elsewhere.

## Commands
- **Test:** `make test-payments` (NOT the root `make test`).

## Module rules
- **IMPORTANT: Separate auth flow.** Payments uses its own mTLS service identity,
  not the shared bearer-token auth from the other services. Never import the
  standard `shared-utils` auth helper here.
- **IMPORTANT: Do not rotate keys without notifying security.** Key rotation is a
  coordinated process — open a ticket and wait for sign-off before changing any
  credential material.
- All monetary amounts are integer **minor units** (cents). Never use floats.
- Every state change must be **idempotent** (keyed by request id) — retries are
  expected and must not double-charge.
