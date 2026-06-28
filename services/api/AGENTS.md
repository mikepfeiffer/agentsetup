# API — Agent Instructions

Inherits root `AGENTS.md`. Rules below are **api-only**.

## Commands
- **Test:** `make test-api` (NOT the root `make test`).

## Module rules
- **Public contract.** This is the externally consumed HTTP API. Never change a
  response schema or status code without a versioned, backward-compatible path.
- **Validate at the edge.** Every handler validates input before calling into
  services; never trust client payloads.
- Return structured JSON errors (`{code, message}`) — never leak stack traces.
