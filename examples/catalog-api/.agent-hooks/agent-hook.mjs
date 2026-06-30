#!/usr/bin/env node
// Shared, portable agent hook implementation for BOTH Claude Code and OpenAI Codex.
//
// One implementation, two thin adapters:
//   .claude/settings.json  -> wires Claude Code events to this script
//   .codex/hooks.json      -> wires Codex events to this script
//
// Design goals:
//   * Cross-platform: only built-in Node modules, no shell pipelines, no deps.
//   * Deterministic guardrails: block obviously risky tool calls before they run.
//   * Auditable: the block rules live in ./policy.json, not buried in code.
//
// Contract:
//   node agent-hook.mjs <mode>
//     mode = "pre-tool-policy"  -> run on PreToolUse; exit 2 (+stderr) to BLOCK.
//     mode = "stop-validate"    -> run on Stop; exit 2 (+stderr) to keep working.
//   Hook event JSON is read from stdin. Exit 0 with NO stdout output = allow.
//   stdout is intentionally never used for normal logging: some hook systems
//   parse stdout as structured output.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.dirname(SCRIPT_DIR); // .agent-hooks lives directly under the repo root.

// Built-in fallback policy. policy.json is the primary source of truth; these
// defaults only apply if that file is missing or partially defined.
const DEFAULT_POLICY = {
  blockedShellPatterns: [
    "rm -rf /",
    "rm -rf .",
    "rm -rf *",
    "sudo rm -rf",
    "git reset --hard",
    "git clean -fdx",
    "git push --force",
    "git push -f",
    "del /s",
    "rmdir /s",
    "Remove-Item -Recurse -Force",
    "format c:",
  ],
  blockedPathPatterns: [
    ".env",
    ".env.*",
    "*.pem",
    "*.key",
    "id_rsa",
    "id_ed25519",
    "secrets/",
    ".secret/",
    ".git/",
    "node_modules/",
    "dist/",
    "build/",
    "coverage/",
    "bin/",
    "obj/",
  ],
};

const STUB_MAX_LINES = 15; // CLAUDE.md must stay a tiny import stub, not a 2nd source of truth.

// ---------------------------------------------------------------------------
// Small helpers (all defensive — a malformed payload must never crash the hook)
// ---------------------------------------------------------------------------

function safeParse(text) {
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function safeStringify(value) {
  try {
    return JSON.stringify(value) || "";
  } catch {
    return "";
  }
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

async function readStdin() {
  // When run without piped input (e.g. a terminal), don't block forever.
  if (process.stdin.isTTY) return "";
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function normalizeCommand(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function truncate(value, max = 200) {
  const s = String(value || "");
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function loadPolicy() {
  const raw = readFileSafe(path.join(SCRIPT_DIR, "policy.json"));
  const parsed = raw ? safeParse(raw) : {};
  return {
    blockedShellPatterns: Array.isArray(parsed.blockedShellPatterns)
      ? parsed.blockedShellPatterns
      : DEFAULT_POLICY.blockedShellPatterns,
    blockedPathPatterns: Array.isArray(parsed.blockedPathPatterns)
      ? parsed.blockedPathPatterns
      : DEFAULT_POLICY.blockedPathPatterns,
  };
}

// ---------------------------------------------------------------------------
// Tool-input parsing (tolerant of Claude Code and Codex payload shapes)
// ---------------------------------------------------------------------------

function looksLikeShell(toolName) {
  return /bash|shell|exec|command|run|terminal|process|sh$/i.test(String(toolName || ""));
}

// Pull a shell command out of the tool input. Handles a plain string or an
// argv array; falls back to the serialized input for shell-like tools.
function extractCommand(toolName, toolInput) {
  let c =
    toolInput.command ??
    toolInput.cmd ??
    toolInput.script ??
    toolInput.commandLine ??
    "";
  if (Array.isArray(c)) c = c.join(" ");
  if (typeof c !== "string") c = "";
  if (!c && looksLikeShell(toolName)) c = safeStringify(toolInput);
  return c;
}

// Collect every file path the tool wants to touch. Looks at well-known fields
// for Claude (Edit/Write/Read/MultiEdit) AND parses Codex apply_patch headers
// out of any string value or the serialized input (the documented fallback).
function collectPaths(toolInput) {
  const paths = new Set();
  const STRING_KEYS = [
    "file_path",
    "filePath",
    "path",
    "notebook_path",
    "filepath",
    "file",
    "dst",
    "destination",
    "target",
  ];
  const ARRAY_KEYS = ["file_paths", "filePaths", "paths", "files"];
  const strings = [];

  (function walk(value) {
    if (value == null) return;
    if (typeof value === "string") {
      strings.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (typeof value === "object") {
      for (const [key, val] of Object.entries(value)) {
        if (STRING_KEYS.includes(key) && typeof val === "string") paths.add(val);
        if (ARRAY_KEYS.includes(key) && Array.isArray(val)) {
          for (const item of val) if (typeof item === "string") paths.add(item);
        }
        walk(val);
      }
    }
  })(toolInput);

  // apply_patch / diff headers, e.g. "*** Update File: src/CatalogApi/appsettings.Production.json".
  const headerRe =
    /\*\*\*\s+(?:Add|Update|Delete|Move(?:\s+(?:to|from))?)\s+File:\s*([^\n"\\]+)/gi;
  const haystacks = strings.concat([safeStringify(toolInput)]);
  for (const haystack of haystacks) {
    headerRe.lastIndex = 0;
    let m;
    while ((m = headerRe.exec(haystack)) !== null) {
      const captured = m[1].trim();
      if (captured) paths.add(captured);
    }
  }

  return [...paths].filter(Boolean);
}

// ---------------------------------------------------------------------------
// Path-pattern matching (simple + auditable, no glob dependency)
// ---------------------------------------------------------------------------

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*");
  return new RegExp("^" + escaped + "$");
}

function matchPath(rawPath, patterns) {
  const norm = String(rawPath).replace(/\\/g, "/").replace(/^\.\//, "");
  const segments = norm.split("/").filter(Boolean);
  const basename = segments.length ? segments[segments.length - 1] : norm;

  for (const pattern of patterns) {
    if (pattern.endsWith("/")) {
      // Directory pattern: match any path segment equal to the dir name.
      const dir = pattern.slice(0, -1);
      if (segments.includes(dir)) return pattern;
    } else if (pattern.includes("*")) {
      // Glob pattern: match the basename or the full normalized path.
      const re = globToRegExp(pattern);
      if (re.test(basename) || re.test(norm)) return pattern;
    } else if (segments.includes(pattern) || basename === pattern) {
      // Literal name: match any exact path segment.
      return pattern;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Mode 1: pre-tool-policy
// ---------------------------------------------------------------------------

function evaluatePreTool(payload, policy) {
  const toolName = payload.tool_name ?? payload.toolName ?? "";
  const toolInput =
    (payload.tool_input ?? payload.toolInput ?? payload.input ?? {}) || {};

  const command = extractCommand(toolName, toolInput);
  const normalized = normalizeCommand(command);
  if (normalized) {
    for (const pattern of policy.blockedShellPatterns) {
      if (normalized.includes(normalizeCommand(pattern))) {
        return {
          blocked: true,
          reason: `Blocked dangerous shell command (matched "${pattern}"): ${truncate(command)}`,
        };
      }
    }
  }

  for (const candidate of collectPaths(toolInput)) {
    const hit = matchPath(candidate, policy.blockedPathPatterns);
    if (hit) {
      return {
        blocked: true,
        reason: `Blocked access to protected path (matched "${hit}"): ${truncate(candidate)}`,
      };
    }
  }

  return { blocked: false };
}

// ---------------------------------------------------------------------------
// Mode 2: stop-validate
// ---------------------------------------------------------------------------

function hasLfRule(gitattributes, ext) {
  const re = new RegExp("\\*\\." + ext + "\\b[^\\n]*eol=lf");
  return re.test(gitattributes);
}

function validateSetup() {
  const failures = [];

  const agents = readFileSafe(path.join(REPO_ROOT, "AGENTS.md"));
  if (agents === null) {
    failures.push("Root AGENTS.md is missing — it is the single source of truth.");
  }

  const claude = readFileSafe(path.join(REPO_ROOT, "CLAUDE.md"));
  if (claude === null) {
    failures.push("Root CLAUDE.md is missing — it must import @AGENTS.md.");
  } else {
    if (!claude.includes("@AGENTS.md")) {
      failures.push("CLAUDE.md must import @AGENTS.md.");
    }
    const lines = claude.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length > STUB_MAX_LINES) {
      failures.push(
        "CLAUDE.md must remain a tiny stub that imports @AGENTS.md (it has grown into a second source of truth)."
      );
    }
  }

  const gitattributes = readFileSafe(path.join(REPO_ROOT, ".gitattributes"));
  if (gitattributes === null) {
    failures.push(".gitattributes is missing LF normalization for *.md, *.json, *.mjs.");
  } else {
    for (const ext of ["md", "json", "mjs"]) {
      if (!hasLfRule(gitattributes, ext)) {
        failures.push(`.gitattributes must normalize *.${ext} to eol=lf.`);
      }
    }
  }

  const required = [
    ".claude/settings.json",
    ".codex/hooks.json",
    ".agent-hooks/agent-hook.mjs",
    ".agent-hooks/policy.json",
  ];
  for (const rel of required) {
    if (!fs.existsSync(path.join(REPO_ROOT, rel))) {
      failures.push(`${rel} is missing.`);
    }
  }

  return failures;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const mode = process.argv[2];
  const payload = safeParse(await readStdin());

  if (mode === "pre-tool-policy") {
    const result = evaluatePreTool(payload, loadPolicy());
    if (result.blocked) {
      process.stderr.write(result.reason + "\n");
      process.exit(2);
    }
    process.exit(0);
  }

  if (mode === "stop-validate") {
    const failures = validateSetup();
    if (failures.length) {
      process.stderr.write(
        "Agent setup validation failed:\n" +
          failures.map((f) => "  - " + f).join("\n") +
          "\n"
      );
      process.exit(2);
    }
    process.exit(0);
  }

  process.stderr.write(
    `Unknown mode: ${mode || "(none)"}. Usage: node agent-hook.mjs <pre-tool-policy|stop-validate>\n`
  );
  process.exit(1);
}

main().catch((err) => {
  // Never let an unexpected error turn into a hard block of the developer's
  // workflow. Report to stderr and exit non-blocking.
  process.stderr.write(`agent-hook.mjs internal error: ${err && err.message}\n`);
  process.exit(1);
});
