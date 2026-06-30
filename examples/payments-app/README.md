# Example: `payments-app`

A tiny, dependency-free **TypeScript** app — an idempotent, integer-cents charge
ledger — that is a **self-contained reference for both core ideas in one folder**:

1. **Shared agent instructions** — its own `AGENTS.md` (source of truth) +
   `CLAUDE.md` (one-line import stub), layered on top of the repo-root
   instructions it inherits.
2. **Deterministic hooks** — its own [`.agent-hooks/`](.agent-hooks/) policy plus
   the thin [`.claude/settings.json`](.claude/settings.json) and
   [`.codex/hooks.json`](.codex/hooks.json) adapters that wire each tool to it.

It is intentionally small. The point is the **setup around** the code.

## Launch the agent *from this directory*

```bash
cd examples/payments-app
claude      # or: codex
```

This matters for the hooks. Agent **settings/hooks load from the directory you
launch in and are *not* inherited from parent folders** — so the hooks here only
fire when this folder is the launch (project) root. Instruction files behave the
opposite way: the **root** `AGENTS.md`/`CLAUDE.md` still load via upward
inheritance, *plus* this folder's. Net result when you launch from here: root
guidance + this app's stricter rules + this app's guardrails, all active.

> Each `examples/<app>/` is its own frame of reference and may wire up hooks
> differently. The repo root is documentation + the shared instruction layer; it
> intentionally has no hooks of its own (see the root [`README.md`](../../README.md) §5).

## What it does

```bash
npm install            # dev-only deps: typescript + @types/node (Node 20 can't run .ts directly)
npm run build          # tsc -> dist/
npm test               # app tests (node --test) + hook tests
npm start -- charge req-1 1299 req-1 1299 req-2 500
# charged: req-1 -> USD 12.99
# duplicate: req-1 -> USD 12.99      <- idempotent: the retry did not double-charge
# charged: req-2 -> USD 5.00
# total: USD 17.99
```

- [`src/money.ts`](src/money.ts) — pure integer-cents helpers. **Never floats.**
- [`src/ledger.ts`](src/ledger.ts) — idempotent charge ledger keyed by `requestId`.
- [`src/cli.ts`](src/cli.ts) — a minimal CLI entry point.
- [`test/`](test/) — `node:test` suites (no test-framework dependency).
- [`.agent-hooks/`](.agent-hooks/) — the shared hook implementation + its tests.

## How the hooks guard this app

The `PreToolUse` hook (`.agent-hooks/agent-hook.mjs pre-tool-policy`) blocks, in
ways you can see directly:

| You try to… | Hook result | Why |
|---|---|---|
| read/edit `.env` | **blocked** | secret file |
| edit anything in `dist/` or `node_modules/` | **blocked** | generated / dependency output |
| run `git push --force`, `rm -rf .`, … | **blocked** | dangerous shell command |
| edit `src/money.ts`, run `npm test` | allowed | ordinary work |

Try it directly (this is what the hook host pipes to the script on stdin):

```bash
printf '{"tool_name":"Edit","tool_input":{"file_path":".env"}}' \
  | node .agent-hooks/agent-hook.mjs pre-tool-policy; echo "exit=$?"   # -> exit=2 (blocked)
```

The `Stop` hook (`stop-validate`) checks this folder's instruction contract
(`AGENTS.md` present, `CLAUDE.md` still a tiny `@AGENTS.md` stub, `.gitattributes`
LF rules, hook wiring present) before the agent says it's done.

These guardrails **supplement** code review, CI, secret scanning, and branch
protection — they don't replace them, and they run with your local permissions.
See [`.agent-hooks/README.md`](.agent-hooks/README.md) for the full contract.

## Note on the `dist/` build step

Node 20 cannot execute `.ts` files directly, so the app compiles with `tsc` to
`dist/` and runs/tests the compiled output. `dist/` and `node_modules/` are
git-ignored — and hook-blocked, so an agent won't accidentally "fix" generated
code instead of the source.
