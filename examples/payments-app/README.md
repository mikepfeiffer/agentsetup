# Example: `payments-app`

A tiny, dependency-free **TypeScript** app — an idempotent, integer-cents charge
ledger — that exists to make the repo's two core ideas **concrete**:

1. **Shared agent instructions** (`AGENTS.md` is the source of truth, `CLAUDE.md`
   is a one-line import stub) — applied here as a *nested* module that inherits
   the root and adds stricter, payments-specific rules.
2. **Deterministic hooks** (`../../.agent-hooks/`) — this app is exactly the kind
   of code those guardrails protect.

It is intentionally small. The point is the **setup around** the code, not the
code itself.

## What it does

```bash
npm install            # dev-only deps: typescript + @types/node (Node 20 can't run .ts directly)
npm run build          # tsc -> dist/
npm test               # compiles, then runs node --test on dist/test
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

## How the core ideas show up here

### Shared agent instructions
[`AGENTS.md`](AGENTS.md) holds the real, module-specific rules (integer cents,
idempotency, validate-at-the-edge). [`CLAUDE.md`](CLAUDE.md) is the same tiny
`@AGENTS.md` stub used everywhere else — **no symlinks**, byte-identical on every
OS. Because it lives below the repo root, it also demonstrates *nested* loading:
Claude Code loads it when you touch this directory; Codex loads it when launched
from here (`cd examples/payments-app && codex`).

### Deterministic hooks
The shared `PreToolUse` hook (`../../.agent-hooks/agent-hook.mjs pre-tool-policy`)
guards this app in ways you can see directly:

| You try to… | Hook result | Why |
|---|---|---|
| read/edit `examples/payments-app/.env` | **blocked** | secret file |
| edit anything in `dist/` or `node_modules/` | **blocked** | generated / dependency output |
| run `git push --force`, `rm -rf .`, … | **blocked** | dangerous shell command |
| edit `src/money.ts`, run `npm test` | allowed | ordinary work |

Try it without leaving the repo (this is what the hook host pipes in):

```bash
printf '{"tool_name":"Edit","tool_input":{"file_path":"examples/payments-app/.env"}}' \
  | node ../../.agent-hooks/agent-hook.mjs pre-tool-policy; echo "exit=$?"   # -> exit=2 (blocked)
```

These guardrails **supplement** code review, CI, secret scanning, and branch
protection — they don't replace them. See the root [`README.md`](../../README.md)
§5 and [`.agent-hooks/README.md`](../../.agent-hooks/README.md).

## Note on the `dist/` build step

Node 20 cannot execute `.ts` files directly, so the app compiles with `tsc` to
`dist/` and runs/tests the compiled output. `dist/` and `node_modules/` are
git-ignored — and hook-blocked, so an agent won't accidentally "fix" generated
code instead of the source.
