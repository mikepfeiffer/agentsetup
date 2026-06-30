# `.agent-hooks/` — one shared hook implementation, two thin adapters

This folder holds **deterministic guardrails** for *both* Claude Code and OpenAI
Codex, scoped to this example (`examples/catalog-api/`). The whole point:
**don't duplicate enforcement logic per tool.** The policy lives here once; each
tool's native hook config just calls into it.

The implementation (`agent-hook.mjs`) is the **same generic Node script** used by
the other examples — only [`policy.json`](policy.json) differs, tailored to .NET.
That is deliberate: agent settings/hooks load from the **launch directory** (not
inherited from parents), so each `examples/<app>/` carries its own. Launch the
agent from `examples/catalog-api/` for these to fire. The repo root has no hooks
of its own (see the root [`README.md`](../../../README.md) §5).

```text
examples/catalog-api/
  .agent-hooks/
    agent-hook.mjs        # shared implementation (Node, no dependencies)
    policy.json           # the block rules — .NET-flavored, primary source
    agent-hook.test.mjs   # tests (built-in Node only)
    test-fixtures/        # sample Claude/Codex hook payloads
  .claude/settings.json   # Claude Code adapter  -> calls agent-hook.mjs
  .codex/hooks.json       # Codex adapter        -> calls agent-hook.mjs
```

## Why Node for a .NET app?

The guardrails are **infrastructure**, so they're written in portable Node
(`node` is a stable executable on macOS, Linux, and Windows) using only built-in
modules — no `jq`/`sed`/PowerShell, no dependencies. The *app* is whatever the
team uses; here that's ASP.NET Core. One hook implementation can guard any
project regardless of its language.

## The contract

```bash
node .agent-hooks/agent-hook.mjs pre-tool-policy   # PreToolUse
node .agent-hooks/agent-hook.mjs stop-validate     # Stop
```

* The hook event JSON is read from **stdin**.
* **Exit 0, no output** = allow.
* **Exit 2 + a short reason on stderr** = block (Claude/Codex surface stderr).
* `stdout` is never used for logging — some hook systems parse it as structured output.
* A missing or malformed payload never crashes the hook; it fails open (allow).

### Mode: `pre-tool-policy` (runs on `PreToolUse`)

What this example's [`policy.json`](policy.json) blocks — note the .NET specifics:

* **Generated EF Core migrations** — `*ModelSnapshot.cs` and `*.Designer.cs`.
  These are produced by `dotnet ef`; change the model and add a **new** migration
  instead of hand-editing them. This is the headline guardrail for this app.
* **Build output** — anything under `bin/` or `obj/`.
* **Secrets / config** — `appsettings.Production.json`, `secrets.json`, `*.pfx`,
  `*.snk`, `*.pem`, `*.key`, `.env*`. Only `appsettings.json` (placeholders) is
  committed; real secrets go in `dotnet user-secrets` / env vars.
* **Dangerous shell commands** — destructive/risky ones including the .NET pair
  `dotnet ef database drop` and `dotnet nuget push`, alongside `rm -rf /`,
  `git push --force`, `format c:`, … Everyday commands (`dotnet build`,
  `dotnet test`, `git status`) pass through.

### Mode: `stop-validate` (runs on `Stop`)

A lightweight check that this example's instruction contract is intact before the
agent declares it's done. The project root it checks is this folder. It verifies
`AGENTS.md` exists; `CLAUDE.md` exists, imports `@AGENTS.md`, and is still a tiny
stub; `.gitattributes` normalizes `*.md`, `*.json`, `*.mjs` to `eol=lf`; and the
hook wiring is present (`.claude/settings.json`, `.codex/hooks.json`,
`.agent-hooks/agent-hook.mjs`, `.agent-hooks/policy.json`).

## Run the tests

```bash
npm run test:hooks       # or: node .agent-hooks/agent-hook.test.mjs
```

The tests spawn `agent-hook.mjs` as a child process, feed it the fixtures in
[`test-fixtures/`](test-fixtures/), and assert on exit codes.

## A note on the Codex command

`.codex/hooks.json` resolves the script as
`$(git rev-parse --show-toplevel)/examples/catalog-api/.agent-hooks/agent-hook.mjs`
so it works from any subdirectory. The Windows key may be `command_windows` (the
JSON-friendly form used here) or `commandWindows` depending on your Codex version;
both express the same intent. Codex's exact hook-config resolution is not
authoritatively documented — if your version reads project hooks from the git
root, place `.codex/hooks.json` accordingly. Claude Code's adapter uses
`${CLAUDE_PROJECT_DIR}` (the launch dir) and is fully documented.

## ⚠️ Hooks are guardrails, not a security boundary

These hooks **supplement** — they do not replace — Git branch protection, CI,
sandboxing, code review, secret scanning, and least-privilege permissions. They
run locally **with the developer's own permissions**, and a determined process
can bypass them. **Review hook scripts before you trust them.**
