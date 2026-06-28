# Monorepo Agent Instructions (Root)

> **Note:** `CLAUDE.md` in this directory is a tiny stub that imports this file
> via `@AGENTS.md`. Codex reads `AGENTS.md` directly; Claude Code reads
> `CLAUDE.md` → `@AGENTS.md`. One source of truth, **no symlinks** (Windows-safe).

## Repo-wide conventions
- **Language:** Python 3.11. Use type hints on public functions.
- **Format / lint:** `make lint` (placeholder — runs ruff + black --check).
- **Test:** `make test` (placeholder — runs the full suite).
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`). Keep them atomic.
- **PRs:** Small and focused. Describe what changed and why; link the issue.

## IMPORTANT — Critical / always-on rules
These live at **root** because root is the only layer BOTH tools reliably load
in every session, regardless of launch directory or compaction.

- **IMPORTANT: Never edit generated files.** Anything under `**/generated/` or
  files marked `# @generated` are produced by tooling — edit the source instead.
- **IMPORTANT: Never commit secrets.** No keys, tokens, or `.env` values in code,
  tests, or fixtures. Use placeholders.
- **IMPORTANT: Payments has a separate auth flow.** Do not reuse the standard
  service auth there — see `services/payments/AGENTS.md` before touching it.
- **IMPORTANT: Never force-push shared branches** (`main`, `release/*`).

## Module map
More specific guidance lives next to the code. Read the module file before
editing within it:
- `services/payments/AGENTS.md` — payment processing (separate auth, key rules).
- `services/api/AGENTS.md` — public HTTP API.
- `packages/shared-utils/AGENTS.md` — shared library used by everything.
