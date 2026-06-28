# Shared Agent Instructions: Claude Code + Codex on a Mixed-OS Monorepo

This repo is a reference for teams using **both Claude Code and OpenAI Codex** on
the same monorepo, across a mix of **Windows and macOS** machines. It shows how
to keep one source of truth for agent instructions without symlinks.

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
| Launch dir matters? | No — nesting follows what you touch. | **Yes** — chain stops at `cwd`. Launch at root and edit `services/payments/` and it will **not** pick up `services/payments/AGENTS.md`. |
| Sibling modules touched later | Loaded when first touched. | **Not** loaded (chain was fixed at launch). |
| After `/compact` | Root survives and is **re-injected**; nested files are **not** re-injected until that directory is touched again. | N/A (different session model). |

**The key asymmetry:** Claude Code's nested loading follows your *activity*;
Codex's follows your *launch directory*. That single difference drives all the
team guidance below.

---

## 3. Practical team guidance

- **Put critical, always-on rules in the ROOT `AGENTS.md`.** Root is the only
  layer **both** tools reliably load in **every** session. (That's why the
  "never edit generated files / never commit secrets / payments auth" rules live
  at root in this repo.)
- **Codex users: launch Codex from inside the module you're focused on** — e.g.
  `cd services/payments && codex` — so its root→cwd chain actually includes that
  module's `AGENTS.md`. For cross-module work, rely on the root rules.
- **Claude Code users:** just work; nested files load as you touch directories.
  After a `/compact`, remember nested context may need a re-touch.
- **Verify what's actually loaded:**
  - Claude Code: run `/memory`.
  - Codex: ask *"Summarize the current instructions"*, or run `codex status`.

---

## 4. Known limitations (guidance vs. enforcement)

These files are **context/guidance, not enforcement**. Both models can drift in
long sessions — an instruction is a strong prior, not a hard gate. For
guarantees, escalate to real enforcement (not configured in this demo):

- **Claude Code:** `PreToolUse` hooks can inspect and **block** a tool call
  (e.g. refuse edits to `**/generated/`).
- **Codex:** `execpolicy` / **sandbox** restricts what commands can run.

Two Codex knobs worth knowing (one line each):
- **`project_doc_max_bytes`** — per-file cap on instruction files Codex reads;
  default **32 KiB**. Keep `AGENTS.md` files small or they get truncated.
- **`AGENTS.override.md`** — if present in a directory, it takes **precedence**
  over that directory's `AGENTS.md`.
