#!/usr/bin/env node
// Tests for the shared agent hook. Built-in Node modules only — no deps.
// Run with: npm run test:hooks  (or: node .agent-hooks/agent-hook.test.mjs)
//
// Each test runs agent-hook.mjs as a child process, pipes a fixture (or inline
// JSON) to stdin, and asserts on the exit code — exactly how a real hook system
// invokes it.

import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, "agent-hook.mjs");
const FIXTURES = path.join(HERE, "test-fixtures");

function run(mode, stdin) {
  return spawnSync(process.execPath, [SCRIPT, mode], {
    input: stdin ?? "",
    encoding: "utf8",
  });
}

function runFixture(mode, fixtureName) {
  return run(mode, readFileSync(path.join(FIXTURES, fixtureName), "utf8"));
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// 1. Claude Bash dangerous command is blocked.
test("Claude Bash dangerous command is blocked", () => {
  const r = runFixture("pre-tool-policy", "claude-pretool-bash-block.json");
  assert.strictEqual(r.status, 2, `expected exit 2, got ${r.status}`);
  assert.ok(r.stderr.trim().length > 0, "expected a reason on stderr");
  assert.strictEqual(r.stdout, "", "must not write to stdout");
});

// 2. Claude Bash safe command is allowed.
test("Claude Bash safe command is allowed", () => {
  const r = runFixture("pre-tool-policy", "claude-pretool-bash-allow.json");
  assert.strictEqual(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
  assert.strictEqual(r.stdout, "", "must not write to stdout");
});

// 3. Claude file edit targeting .env is blocked.
test("Claude edit targeting .env is blocked", () => {
  const r = runFixture("pre-tool-policy", "claude-pretool-edit-secret-block.json");
  assert.strictEqual(r.status, 2, `expected exit 2, got ${r.status}`);
  assert.ok(/\.env/.test(r.stderr), "expected the reason to mention the path");
});

// 4. Codex Bash dangerous command is blocked.
test("Codex Bash dangerous command is blocked", () => {
  const r = runFixture("pre-tool-policy", "codex-pretool-bash-block.json");
  assert.strictEqual(r.status, 2, `expected exit 2, got ${r.status}`);
  assert.ok(r.stderr.trim().length > 0, "expected a reason on stderr");
});

// 5. Codex Bash safe command is allowed.
test("Codex Bash safe command is allowed", () => {
  const r = runFixture("pre-tool-policy", "codex-pretool-bash-allow.json");
  assert.strictEqual(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
});

// 6. Codex apply_patch touching .env is blocked.
test("Codex apply_patch touching .env is blocked", () => {
  const r = runFixture("pre-tool-policy", "codex-pretool-apply-patch-secret-block.json");
  assert.strictEqual(r.status, 2, `expected exit 2, got ${r.status}`);
  assert.ok(/\.env/.test(r.stderr), "expected the reason to mention the path");
});

// 7. stop-validate passes when the repo is correctly configured.
test("stop-validate passes for a correctly configured repo", () => {
  const r = run("stop-validate", "{}");
  assert.strictEqual(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
  assert.strictEqual(r.stdout, "", "must not write to stdout");
});

// --- extra guards: a malformed/empty payload must never crash the hook ---
test("malformed payload does not crash pre-tool-policy", () => {
  const r = run("pre-tool-policy", "not json {{{");
  assert.strictEqual(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    process.stdout.write(`ok   - ${name}\n`);
  } catch (err) {
    failed += 1;
    process.stdout.write(`FAIL - ${name}\n       ${err.message}\n`);
  }
}

process.stdout.write(`\n${tests.length - failed}/${tests.length} passed\n`);
process.exit(failed === 0 ? 0 : 1);
