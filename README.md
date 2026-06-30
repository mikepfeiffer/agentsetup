# Agent Setup: Shared Instructions and Guardrails for Claude Code + Codex

This project is a reference for teams using Claude Code or OpenAI Codex on the same monorepo, across both Windows and macOS, so your AI coding agents:

1. **Follow your project's rules**, and
2. **Can't easily do risky things** like deleting the wrong files, committing a
   password, or hand-editing auto-generated code, or
3. **Consistently apply clean coding standards** so your project does not drift into anti-patterns and hard-to-maintain code.

The goal is simple: give your AI coding agents clear instructions, practical guardrails, and repeatable standards before it starts changing your codebase.

Everything here works on Windows and macOS, with no symlinks required. The repo also includes two complete example apps (one TypeScript and one C#) that you can study, copy, or adapt for your own projects.

## The two ideas, in plain English

Everything in this repo is built from two simple pieces:

- **Instructions** — a plain text file (`AGENTS.md`) the agent reads *before* it
  starts working, like a short brief you'd hand a new teammate: "we use X, never
  Y; money is handled this way; don't touch that folder." Both Claude Code and
  Codex read it.
- **Guardrails** (the technical name is **hooks**) — tiny automatic checks that
  run *right before* the agent does something and can **stop** it. If the agent
  tries to wipe a folder, edit a generated file, or leak a secret, the guardrail
  blocks it before it happens.

The difference matters: **instructions are advice the agent almost always
follows; guardrails are a hard stop it can't talk its way around.** Good setups
use both — instructions to guide, guardrails to catch the rare slip.

> The rest of this page is the "how." Skim the section you care about — you don't
> need to read all of it to get value.

## Try it

Pick the example closest to your stack, open that folder with your agent, and
start building:

```bash
cd examples/payments-app    # TypeScript   (or: cd examples/catalog-api for C#)
claude                      # or: codex
```

Because you launched *inside* the example, the agent automatically reads that
project's rules and runs its guardrails. Make a normal edit and it goes through;
try something risky (touching a secret file, a generated file, `git push
--force`) and the guardrail blocks it.

## What's in this repo

```text
AGENTS.md / CLAUDE.md       # the shared rules every agent session reads (§1)
examples/                   # two complete apps — each one you "launch into" (§5)
  payments-app/             # TypeScript — a tiny charge ledger
    AGENTS.md / CLAUDE.md   #   its own extra rules (added on top of the root ones)
    .agent-hooks/           #   its own guardrails (§5)
    .claude/  .codex/       #   tells each tool how to run those guardrails
    src/ test/              #   the actual app + tests
  catalog-api/              # C# / ASP.NET Core — a product catalog API
    AGENTS.md / CLAUDE.md   #   same idea, .NET-specific rules & guardrails
    .agent-hooks/ .claude/ .codex/
    src/ tests/
```

The repo **root holds the shared rules and this documentation** — no guardrails
of its own. The **guardrails live inside each example**, because (as §5 explains)
each tool only loads guardrails from the folder you start it in. Two examples,
two different rule sets: the *patterns* repeat, the *details* change with the
language.

---

## 1. Write your rules once (instructions)

In every folder that needs agent guidance there are two files:

- **`AGENTS.md`** — the real content. Codex reads this natively, and Claude Code
  pulls it in via the import below.
- **`CLAUDE.md`** — a tiny **stub** (a real file, identical on every OS) whose
  only job is to import the sibling `AGENTS.md`:

  ```
  # Project instructions
  See @AGENTS.md for all guidance. This file intentionally only imports
  AGENTS.md so that Claude Code and Codex share one source of truth.

  @AGENTS.md
  ```

  The `@AGENTS.md` line is what makes Claude Code actually load the content.

So both tools end up driven by the **same `AGENTS.md`**: Codex reads it directly;
Claude Code reads `CLAUDE.md`, which imports it. Write your rules once, and you
never have to keep two copies in sync.

### Why not symlinks?

The obvious shortcut is to make `CLAUDE.md` a symlink (a file that just points at
`AGENTS.md`). **Don't.** Windows + Git break symlinks routinely: unless
`core.symlinks=true` is set (which needs elevated/Developer-mode permissions),
Git checks the link out as a **plain text file containing the target's path**. A
macOS dev would commit a real symlink; a Windows teammate would clone a broken
9-byte file that literally contains the text `AGENTS.md` instead of the
instructions. The `@import` stub avoids this entirely — it's just a normal file
everywhere.

### Keeping files identical across Windows & macOS (line endings)

A `.gitattributes` file forces **LF** line endings for text files:

```
*.md   text eol=lf
*.ts   text eol=lf
*.json text eol=lf
*.mjs  text eol=lf
```

(Each example adds the file types it uses — e.g. `*.cs` for the C# app.) Without
this, Windows checkouts can silently switch to CRLF line endings, making the same
file look "changed" on different machines and producing noisy diffs. For files
that are meant to be a shared contract, that churn matters.

---

## 2. How each tool loads your rules

This is the one genuinely fiddly part. The short version: **Claude Code loads a
folder's rules when it touches a file in that folder; Codex decides up front,
based on where you started it.** Here's the full picture:

| Behavior | **Claude Code** | **OpenAI Codex** |
|---|---|---|
| Root instructions | Loads root `CLAUDE.md` (and its `@AGENTS.md` import) at **session start**. | Resolves the **root → current-folder** chain at **session start**. |
| What "root" means | The repo root (detected via `.git`). | The repo root (detected via `.git`). |
| Nested folder files | Loaded **on demand** when Claude reads/edits a file in that folder — **regardless of where you launched**. | Only the folders **on the path from root down to where you launched** are loaded, fixed at launch. |
| Where you launch matters? | No — guidance follows what you touch. | **Yes** — the chain stops at your launch folder. Launch at the root and edit `examples/payments-app/`, and Codex will **not** pick up `examples/payments-app/AGENTS.md`. |
| Sibling folders touched later | Loaded when first touched. | **Not** loaded (the chain was fixed at launch). |
| After `/compact` (context cleanup) | Root survives and is **re-injected**; nested files are **not** re-injected until that folder is touched again. | N/A (different session model). |

**The key difference:** Claude Code's nested loading follows your *activity*;
Codex's follows your *launch folder*. That single difference drives the tips
below.

---

## 3. Day-to-day tips

- **Put your most important, always-on rules in the root `AGENTS.md`.** The root
  is the only layer **both** tools reliably load in **every** session. (That's
  why "never commit secrets" and "never edit generated files" live at the root
  here.)
- **Using Codex? Launch it from inside the folder you're working in** — e.g.
  `cd examples/catalog-api && codex` — so its root→folder chain actually includes
  that project's `AGENTS.md`. For cross-project work, rely on the root rules.
- **Using Claude Code? Just work** — nested rules load as you touch folders.
  After a `/compact`, a nested folder's rules may need a re-touch to come back.
- **Check what's actually loaded:**
  - Claude Code: run `/memory`.
  - Codex: ask *"Summarize the current instructions"*, or run `codex status`.

---

## 4. Instructions are advice — guardrails are the hard stop

Instruction files are **guidance, not a guarantee**. Both models can drift in a
long session — an instruction is a strong nudge, not a locked door. When you need
an actual guarantee, you reach for the guardrails in
[§5](#5-guardrails-hooks):

- **Claude Code:** `PreToolUse` hooks can inspect an action and **block** it
  (e.g. refuse to edit anything in a `generated/` folder).
- **Codex:** a sandbox / command policy restricts what can run, and Codex hooks
  can run the same guardrail script.

Two advanced Codex knobs worth knowing (one line each):
- **`project_doc_max_bytes`** — a size cap on instruction files Codex reads;
  default **32 KiB**. Keep `AGENTS.md` files small or they get truncated.
- **`AGENTS.override.md`** — if present in a folder, it takes **precedence** over
  that folder's `AGENTS.md`.

---

## 5. Guardrails (hooks)

Sections 1–4 are about **guidance**. Instructions shape behavior but can't
*guarantee* it. Guardrails are the deterministic complement: they run as code on
every matching action and can **block** it, no matter what the model intended.

### Why guardrails live in each example, not at the root

Instructions and guardrails load **differently**, and this drives the whole
layout:

| | `AGENTS.md` / `CLAUDE.md` (instructions) | `.claude/settings.json` etc. (guardrails) |
|---|---|---|
| Loading | **Inherited upward** — the root file loads no matter which subfolder you launch from. | **Launch-folder only** — read from the folder you start the agent in, **not** inherited from parents. |

So a guardrail config sitting at the repo root would **not** fire while you work
inside `examples/payments-app/` — only that folder's own config would. The fix is
to **put the guardrails in the project you launch into.** Each `examples/<app>/`
is therefore a **self-contained project**: launch the agent from inside it and
you get the **root** instructions (inherited up) **plus** that example's
instructions **and** that example's guardrails. The root stays documentation-only.

```bash
cd examples/payments-app
claude      # or: codex   — now this example's guardrails are active
```

A bonus: each example can wire up guardrails **differently**, giving you several
frames of reference instead of one. (The TypeScript example blocks `.env` and
`dist/`; the C# example blocks generated EF Core migrations and `appsettings.Production.json`.)

### Inside an example: one implementation, two thin adapters

Within a single example the §1 "write it once" principle still applies — don't
write the guardrail logic twice and let the Claude and Codex copies drift apart.
Keep **one** implementation and point each tool at it:

```text
examples/payments-app/
  .agent-hooks/
    agent-hook.mjs        # the guardrail logic  (Node, zero dependencies)
    policy.json           # the rules it enforces (the block lists)
  .claude/settings.json   # Claude Code adapter -> calls agent-hook.mjs
  .codex/hooks.json       # Codex adapter       -> calls agent-hook.mjs
```

Both adapters invoke the **same script** in two modes:

- **`pre-tool-policy`** (before every action) — blocks dangerous shell commands
  (`rm -rf /`, `git push --force`, `format c:`, …), reads/writes of secret files
  (`.env`, `*.pem`, `id_rsa`, …), and edits to generated/dependency folders
  (`node_modules/`, `dist/`, `build/`, …). Everyday commands like `git status`,
  `npm test`, and `dotnet build` pass straight through.
- **`stop-validate`** (when the agent says it's done) — a quick check that the
  example's setup is still intact: `AGENTS.md` exists, `CLAUDE.md` is still a tiny
  `@AGENTS.md` stub (not a second source of truth), and `.gitattributes` keeps LF
  normalization for `*.md`, `*.json`, and `*.mjs`.

| | **Claude Code** (`.claude/settings.json`) | **Codex** (`.codex/hooks.json`) |
|---|---|---|
| Events | `PreToolUse` (matcher `Bash\|Read\|Edit\|Write\|MultiEdit`) + `Stop` (no matcher) | `PreToolUse` (matcher `Bash\|Edit\|Write\|apply_patch`) + `Stop` |
| Path to script | `${CLAUDE_PROJECT_DIR}/.agent-hooks/agent-hook.mjs` — the launch folder, substituted by Claude (cross-platform) | `$(git rev-parse --show-toplevel)/examples/payments-app/.agent-hooks/...` — git root + the example path, so it resolves from any subfolder |
| Windows | handled by `${CLAUDE_PROJECT_DIR}` | a separate `command_windows` variant (some versions accept `commandWindows`) |

The **logic is identical** because both call the same file. Change a rule once in
`policy.json` and both tools pick it up — no drift.

### Run the guardrail tests

```bash
cd examples/payments-app
npm run test:hooks      # or `npm test` to run the app's tests too
```

This feeds sample Claude and Codex actions (`.agent-hooks/test-fixtures/`) to the
script and checks the right things are blocked or allowed. The script uses **only
built-in Node, no dependencies**, so it runs the same on every machine.

### See what's wired up

Launched from the example folder:
- **Claude Code:** run `/hooks`.
- **Codex:** run `/hooks`.

### ⚠️ Guardrails are a safety net, not a security wall

Treat these guardrails as a net that catches obvious mistakes — **not** as a
complete security control. They **supplement, but do not replace**:

- Git **branch protection** and required reviews,
- **CI** checks,
- **sandboxing** / least-privilege permissions,
- **secret scanning**,
- human **code review**.

Guardrail scripts run **locally with your own permissions**, and a determined
process can bypass them. **Read a guardrail script before you trust it**, exactly
as you would any other code that runs on your machine. See
[`examples/payments-app/.agent-hooks/README.md`](examples/payments-app/.agent-hooks/README.md)
for the full contract.
