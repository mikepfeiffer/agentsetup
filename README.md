# Shared Agent Instructions: Claude Code + Codex on a Mixed-OS Monorepo

This repo is a reference for teams using **both Claude Code and OpenAI Codex** on
the same monorepo, across a mix of **Windows and macOS** machines. It shows how
to keep one source of truth for agent instructions without symlinks.

### Repository layout

```text
AGENTS.md / CLAUDE.md   # shared instruction layer (§1) — root source of truth + stub
.agent-hooks/           # shared, deterministic hook implementation (§5)
.claude/settings.json   # Claude Code hook adapter (§5)
.codex/hooks.json       # Codex hook adapter (§5)
examples/
  payments-app/         # a small, working TypeScript app that uses both ideas
```

---

## 1. The portable, one-source-of-truth pattern

In every directory that needs agent guidance there are two files:

- **`AGENTS.md`** — the real content. Codex reads this natively, and Claude Code
  pulls it in via the import below.
- **`CLAUDE.md`** — a tiny **stub** (a real file, byte-identical on every OS)
  whose only job is to import the sibling `AGENTS.md`:

  ```
  # Project instructions
  See @AGENTS.md for all guidance. This file intentionally only imports
  AGENTS.md so that Claude Code and Codex share one source of truth.

  @AGENTS.md
  ```

  The `@AGENTS.md` line is what makes Claude Code actually load the content.

So both tools end up driven by the **same `AGENTS.md`**: Codex reads it directly;
Claude Code reads `CLAUDE.md`, which imports it.

### Why not symlinks?

The obvious idea is to make `CLAUDE.md` a symlink to `AGENTS.md`. **Don't.**
Windows + Git break symlinks routinely: unless `core.symlinks=true` is set
(which needs elevated/Developer-mode permissions), Git checks the link out as a
**plain text stub file containing the target path**. A macOS dev would commit a
real symlink; a Windows teammate would clone a broken 9-byte text file that says
`AGENTS.md` instead of the instructions. The `@import` stub avoids this entirely
— it's just a normal file everywhere.

### Line-ending normalization

`.gitattributes` forces **LF** for `*.md` and `*.py`:

```
*.md  text eol=lf
*.py  text eol=lf
```

Without this, Windows checkouts can introduce CRLF, making the instruction files
**not byte-identical** across the team and producing noisy whitespace-only diffs.
For files that are meant to be a shared contract, that churn matters.

---

## 2. How nested loading actually differs between the tools

| Behavior | **Claude Code** | **OpenAI Codex** |
|---|---|---|
| Root instructions | Loads root `CLAUDE.md` (and its `@AGENTS.md` import) at **session start**. | Resolves the **root → cwd** chain at **session start**. |
| What "root" means | Detected via `.git`. | Detected via `.git` (hence `git init` below). |
| Nested module files | Loaded **on demand** when Claude reads/edits a file in that directory — **regardless of launch dir**. | Only the dirs **on the path from root down to cwd** are loaded, fixed at launch. |
| Launch dir matters? | No — nesting follows what you touch. | **Yes** — chain stops at `cwd`. Launch at root and edit `examples/payments-app/` and it will **not** pick up `examples/payments-app/AGENTS.md`. |
| Sibling modules touched later | Loaded when first touched. | **Not** loaded (chain was fixed at launch). |
| After `/compact` | Root survives and is **re-injected**; nested files are **not** re-injected until that directory is touched again. | N/A (different session model). |

**The key asymmetry:** Claude Code's nested loading follows your *activity*;
Codex's follows your *launch directory*. That single difference drives all the
team guidance below.

---

## 3. Practical team guidance

- **Put critical, always-on rules in the ROOT `AGENTS.md`.** Root is the only
  layer **both** tools reliably load in **every** session. (That's why the
  "never edit generated files / never commit secrets / money-is-integer-cents"
  rules live at root in this repo.)
- **Codex users: launch Codex from inside the module you're focused on** — e.g.
  `cd examples/payments-app && codex` — so its root→cwd chain actually includes
  that module's `AGENTS.md`. For cross-module work, rely on the root rules.
- **Claude Code users:** just work; nested files load as you touch directories.
  After a `/compact`, remember nested context may need a re-touch.
- **Verify what's actually loaded:**
  - Claude Code: run `/memory`.
  - Codex: ask *"Summarize the current instructions"*, or run `codex status`.

---

## 4. Known limitations (guidance vs. enforcement)

These files are **context/guidance, not enforcement**. Both models can drift in
long sessions — an instruction is a strong prior, not a hard gate. For
guarantees, escalate to real enforcement. This repo now ships an **optional
reference implementation** of that enforcement layer (see
[§5](#5-optional-deterministic-hooks)):

- **Claude Code:** `PreToolUse` hooks can inspect and **block** a tool call
  (e.g. refuse edits to `**/generated/`).
- **Codex:** `execpolicy` / **sandbox** restricts what commands can run, and
  Codex hooks can run the same shared policy script.

Two Codex knobs worth knowing (one line each):
- **`project_doc_max_bytes`** — per-file cap on instruction files Codex reads;
  default **32 KiB**. Keep `AGENTS.md` files small or they get truncated.
- **`AGENTS.override.md`** — if present in a directory, it takes **precedence**
  over that directory's `AGENTS.md`.

---

## 5. Optional deterministic hooks

Sections 1–4 are about **guidance**. Instructions shape behavior but can't
*guarantee* it. Hooks are the deterministic complement: they run as code on
every matching tool call and can **block** it regardless of what the model
"intended."

The same source-of-truth principle from §1 applies to hooks. Instead of writing
the policy twice (once for Claude Code, once for Codex) and watching the two
copies drift, this repo keeps **one shared implementation** and wires each tool
to it with a thin adapter:

```text
.agent-hooks/
  agent-hook.mjs        # shared implementation  (Node, zero dependencies)
  policy.json           # shared policy rules     (the block lists)

.claude/settings.json   # Claude Code adapter -> calls agent-hook.mjs
.codex/hooks.json       # Codex adapter       -> calls agent-hook.mjs
```

Both adapters invoke the **same script** in two modes:

- **`pre-tool-policy`** on `PreToolUse` — blocks dangerous shell commands
  (`rm -rf /`, `git push --force`, `format c:`, …), edits/reads of secret files
  (`.env`, `*.pem`, `id_rsa`, …), and writes into `.git/` or generated/dependency
  folders (`node_modules/`, `dist/`, `build/`, …). Safe commands like
  `git status`, `npm test`, and `dotnet build` pass through untouched.
- **`stop-validate`** on `Stop` — a fast check that the §1 contract still holds:
  `AGENTS.md` exists, `CLAUDE.md` is still a tiny `@AGENTS.md` stub (not a second
  source of truth), and `.gitattributes` keeps LF normalization for `*.md`,
  `*.json`, and `*.mjs`.

### How the two tools wire in differently

| | **Claude Code** (`.claude/settings.json`) | **Codex** (`.codex/hooks.json`) |
|---|---|---|
| Events | `PreToolUse` (matcher `Bash\|Read\|Edit\|Write\|MultiEdit`) + `Stop` (no matcher) | `PreToolUse` (matcher `Bash\|Edit\|Write\|apply_patch`) + `Stop` |
| Path to script | `${CLAUDE_PROJECT_DIR}/.agent-hooks/agent-hook.mjs` (Claude substitutes the var, cross-platform) | `$(git rev-parse --show-toplevel)/.agent-hooks/...` — resolves the repo root because Codex may launch from a subdirectory |
| Windows | handled by `${CLAUDE_PROJECT_DIR}` | separate `command_windows` variant (some versions accept `commandWindows`) |

The **enforcement logic is identical** because both call the same file. Change a
rule once in `policy.json` and both tools pick it up — no drift.

### Run the hook tests

```bash
npm run test:hooks
```

This runs `agent-hook.mjs` against sample Claude and Codex payloads
(`.agent-hooks/test-fixtures/`) and asserts the right things are blocked/allowed.
No `npm install` needed — the demo uses Node's built-in modules and **no package
dependencies** for portability.

### Inspect what's wired up

- **Claude Code:** run `/hooks`.
- **Codex:** run `/hooks`.

### ⚠️ Hooks are guardrails, not a security boundary

Treat these hooks as a safety net that catches obvious mistakes — **not** as a
complete security control. They **supplement, but do not replace**:

- Git **branch protection** and required reviews,
- **CI** checks,
- **sandboxing** / least-privilege permissions,
- **secret scanning**,
- human **code review**.

Hook scripts run **locally with the developer's own permissions**, and a
determined process can bypass or disable them. **Review hook code before trusting
it**, exactly as you would any other script that runs on your machine. See
[`.agent-hooks/README.md`](.agent-hooks/README.md) for the full contract.
