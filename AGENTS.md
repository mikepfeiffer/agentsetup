# Monorepo Agent Instructions (Root)

> **Note:** `CLAUDE.md` in this directory is a tiny stub that imports this file
> via `@AGENTS.md`. Codex reads `AGENTS.md` directly; Claude Code reads
> `CLAUDE.md` → `@AGENTS.md`. One source of truth, **no symlinks** (Windows-safe).

## Repo-wide conventions
- **Language:** per example — TypeScript/Node (`payments-app`) or C#/.NET
  (`catalog-api`). Every example's hook tooling is plain Node ESM, no dependencies.
- **Format / lint:** an example's own check (e.g. `npm run typecheck` or
  `dotnet build`) — placeholder for a future eslint/prettier/analyzer pass.
- **Test:** `cd examples/<app>` and run its app tests (`npm test` or
  `dotnet test`) plus its hook tests (`npm run test:hooks`). Root delegates:
  `npm run test:payments-app`, `npm run test:catalog-api`.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`). Keep them atomic.
- **PRs:** Small and focused. Describe what changed and why; link the issue.

## IMPORTANT — Critical / always-on rules
These live at **root** because root is the only layer BOTH tools reliably load
in every session, regardless of launch directory or compaction.

- **IMPORTANT: Never edit generated files.** Anything under `**/generated/` or
  files marked `# @generated` are produced by tooling — edit the source instead.
- **IMPORTANT: Never commit secrets.** No keys, tokens, or `.env` values in code,
  tests, or fixtures. Use placeholders.
- **IMPORTANT: Never use binary floats (`float`/`double`/JS `number`) for money.**
  Use an exact type, following the rule in the example you're in — integer minor
  units in `examples/payments-app/AGENTS.md`, `decimal` in
  `examples/catalog-api/AGENTS.md`.
- **IMPORTANT: Never force-push shared branches** (`main`, `release/*`).

## Module map
More specific guidance lives next to the code. Read the module file before
editing within it. Each example is a self-contained project — **launch the agent
from inside it** so its hooks are active.
- `examples/payments-app/AGENTS.md` — TypeScript reference (integer-cents,
  idempotent charge ledger); stricter, module-specific rules + its own hooks.
- `examples/catalog-api/AGENTS.md` — ASP.NET Core + EF Core reference (decimal
  money, "never hand-edit migrations", ProblemDetails) + its own .NET hook policy.
- `examples/<app>/.agent-hooks/README.md` — that example's deterministic hook
  layer (one implementation, a `.claude/` and a `.codex/` adapter). The repo root
  has no hooks of its own; see README §5.
