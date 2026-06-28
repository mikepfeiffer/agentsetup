# shared-utils — Agent Instructions

Inherits root `AGENTS.md`. Rules below are **shared-utils-only**.

## Commands
- **Test:** `make test-utils` (NOT the root `make test`).

## Module rules
- **No app dependencies.** This package must not import from `services/*` —
  dependencies flow one way (services → shared-utils), never back.
- **Stable surface.** It is imported everywhere; treat every public function as
  an API. Don't change signatures without updating all call sites in the same PR.
- Keep functions pure and side-effect free where possible.
