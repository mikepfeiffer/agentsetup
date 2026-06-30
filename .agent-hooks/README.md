# `.agent-hooks/` — one shared hook implementation, two thin adapters

This folder holds **deterministic guardrails** that run for *both* Claude Code
and OpenAI Codex. The whole point: **don't duplicate enforcement logic per tool.**
The policy lives here once; each tool's native hook config just calls into it.

```text
.agent-hooks/
  agent-hook.mjs        # shared implementation (Node, no dependencies)
  policy.json           # the block rules — primary source of truth
  agent-hook.test.mjs   # tests (built-in Node only)
  test-fixtures/        # sample Claude/Codex hook payloads

.claude/settings.json   # Claude Code adapter  -> calls agent-hook.mjs
.codex/hooks.json       # Codex adapter        -> calls agent-hook.mjs
```

## Why Node with no dependencies?

`node` is a stable executable name on macOS, Linux, **and** Windows, and the
script uses only built-in modules. No `jq`/`sed`/`grep`, no Bash-only pipelines,
no PowerShell-only logic — so the same file runs unchanged across the team's
mixed-OS machines. No `npm install` is required to use or test the hooks.

## The contract

```bash
node .agent-hooks/agent-hook.mjs pre-tool-policy   # PreToolUse
node .agent-hooks/agent-hook.mjs stop-validate     # Stop
```

* The hook event JSON is read from **stdin**.
* **Exit 0, no output** = allow.
* **Exit 2 + a short reason on stderr** = block (Claude/Codex surface stderr).
* `stdout` is never used for logging — some hook systems parse it as structured
  output.
* A missing or malformed payload never crashes the hook; it fails open (allow)
  rather than wedging the developer's workflow.

### Mode: `pre-tool-policy` (runs on `PreToolUse`)

Inspects `tool_name`, `tool_input.command`, `tool_input.file_path` (and other
common path fields), and — as a fallback — the serialized `tool_input` (this is
how a Codex `apply_patch` touching `.env` gets caught even though the path is
embedded in the patch text). It blocks:

* **Dangerous shell commands** — `rm -rf /`, `git reset --hard`,
  `git push --force`, `Remove-Item -Recurse -Force`, `format c:`, … while
  leaving everyday commands (`git status`, `npm test`, `dotnet build`,
  `python -m pytest`) alone.
* **Secret / private files** — `.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa`,
  `id_ed25519`, `secrets/`, `.secret/`.
* **Git internals** — anything under `.git/`.
* **Generated / dependency output** — `node_modules/`, `dist/`, `build/`,
  `coverage/`, `bin/`, `obj/`.

All of these patterns live in [`policy.json`](policy.json) so they're easy to
audit and extend. The script keeps a built-in copy of the same defaults as a
fallback if `policy.json` is missing.

### Mode: `stop-validate` (runs on `Stop`)

A lightweight check that the shared-instruction contract is still intact before
the agent declares it's done — no slow tests here. It verifies:

1. Root `AGENTS.md` exists.
2. Root `CLAUDE.md` exists and imports `@AGENTS.md`.
3. `CLAUDE.md` is still a *tiny stub* (it hasn't grown into a second source of truth).
4. `.gitattributes` normalizes `*.md`, `*.json`, and `*.mjs` to `eol=lf`.
5. The hook wiring exists: `.claude/settings.json`, `.codex/hooks.json`,
   `.agent-hooks/agent-hook.mjs`, `.agent-hooks/policy.json`.

## Run the tests

```bash
npm run test:hooks
```

The tests spawn `agent-hook.mjs` as a child process, feed it the fixtures in
[`test-fixtures/`](test-fixtures/), and assert on exit codes — the same way a
real hook host invokes it.

## A note on the Codex Windows command

`.codex/hooks.json` resolves the repo root with `git rev-parse --show-toplevel`
rather than assuming the current directory is the root, because Codex may be
launched from a subdirectory. It provides a POSIX `command` and a
`command_windows` variant. Depending on your Codex version, the Windows key may
be accepted as `command_windows` (the JSON-friendly form used here) or
`commandWindows`; both express the same intent. Adjust to match your installed
Codex if needed — the shared script it calls does not change.

## ⚠️ Hooks are guardrails, not a security boundary

These hooks **supplement** — they do not replace — Git branch protection, CI
checks, sandboxing, code review, secret scanning, and least-privilege
permissions. They run locally **with the developer's own permissions**, and a
determined process can bypass or disable them. **Review hook scripts before you
trust them**, exactly as you would any other code that runs on your machine.
