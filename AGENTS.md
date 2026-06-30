# Monorepo Agent Instructions (Root)

> **Note:** `CLAUDE.md` in this directory is a tiny stub that imports this file
> via `@AGENTS.md`. Codex reads `AGENTS.md` directly; Claude Code reads
> `CLAUDE.md` → `@AGENTS.md`. One source of truth, **no symlinks** (Windows-safe).

## Repo-wide conventions
- **Language:** TypeScript / Node (Node 20+). Use explicit types on public APIs.
  Tooling (the shared hooks) is plain Node ESM with no dependencies.
- **Format / lint:** `npm run typecheck` in a package (placeholder for a future
  eslint/prettier pass).
- **Test:** `npm run test:hooks` (hook suite) and `npm test` inside an example.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`). Keep them atomic.
- **PRs:** Small and focused. Describe what changed and why; link the issue.

## IMPORTANT — Critical / always-on rules
These live at **root** because root is the only layer BOTH tools reliably load
in every session, regardless of launch directory or compaction.

- **IMPORTANT: Never edit generated files.** Anything under `**/generated/` or
  files marked `# @generated` are produced by tooling — edit the source instead.
- **IMPORTANT: Never commit secrets.** No keys, tokens, or `.env` values in code,
  tests, or fixtures. Use placeholders.
- **IMPORTANT: Money is integer minor units (cents), never floats.** Any code
  handling money follows the payments rules — see
  `examples/payments-app/AGENTS.md` before touching it.
- **IMPORTANT: Never force-push shared branches** (`main`, `release/*`).

## Module map
More specific guidance lives next to the code. Read the module file before
editing within it:
- `examples/payments-app/AGENTS.md` — the reference app (integer-cents,
  idempotent charge ledger); stricter, module-specific rules.
- `.agent-hooks/README.md` — the shared, deterministic hook layer that both
  Claude Code and Codex wire into (see README §5).
