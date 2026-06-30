#!/usr/bin/env node
// Tests for the shared agent hook, with this example's .NET-flavored policy.
// Built-in Node modules only — no deps. Run with: npm run test:hooks
//
// Each test runs agent-hook.mjs as a child process, pipes a fixture to stdin,
// and asserts on the exit code — exactly how a real hook host invokes it.

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

// 1. Dangerous dotnet command (drop the database) is blocked.
test("dotnet ef database drop is blocked", () => {
  const r = runFixture("pre-tool-policy", "claude-pretool-dotnet-block.json");
  assert.strictEqual(r.status, 2, `expected exit 2, got ${r.status}`);
  assert.ok(r.stderr.trim().length > 0, "expected a reason on stderr");
  assert.strictEqual(r.stdout, "", "must not write to stdout");
});

// 2. Safe dotnet command is allowed.
test("dotnet test is allowed", () => {
  const r = runFixture("pre-tool-policy", "claude-pretool-dotnet-allow.json");
  assert.strictEqual(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
});

// 3. Editing appsettings.Production.json (secrets) is blocked.
test("editing appsettings.Production.json is blocked", () => {
  const r = runFixture("pre-tool-policy", "claude-pretool-appsettings-secret-block.json");
  assert.strictEqual(r.status, 2, `expected exit 2, got ${r.status}`);
  assert.ok(/appsettings\.Production\.json/.test(r.stderr));
});

// 4. Editing a generated EF migration snapshot is blocked.
test("editing a generated EF migration snapshot is blocked", () => {
  const r = runFixture("pre-tool-policy", "claude-pretool-migration-block.json");
  assert.strictEqual(r.status, 2, `expected exit 2, got ${r.status}`);
  assert.ok(/ModelSnapshot\.cs/.test(r.stderr));
});

// 5. Editing build output under bin/ is blocked (Codex Write).
test("writing into bin/ is blocked", () => {
  const r = runFixture("pre-tool-policy", "codex-pretool-bin-block.json");
  assert.strictEqual(r.status, 2, `expected exit 2, got ${r.status}`);
});

// 6. Codex apply_patch touching appsettings.Production.json is blocked.
test("Codex apply_patch touching appsettings.Production.json is blocked", () => {
  const r = runFixture("pre-tool-policy", "codex-pretool-apply-patch-secret-block.json");
  assert.strictEqual(r.status, 2, `expected exit 2, got ${r.status}`);
  assert.ok(/appsettings\.Production\.json/.test(r.stderr));
});

// 7. Editing ordinary source is allowed.
test("editing src/CatalogApi/Program.cs is allowed", () => {
  const r = runFixture("pre-tool-policy", "claude-pretool-src-allow.json");
  assert.strictEqual(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
});

// 8. stop-validate passes when the example is correctly configured.
test("stop-validate passes for a correctly configured example", () => {
  const r = run("stop-validate", "{}");
  assert.strictEqual(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
  assert.strictEqual(r.stdout, "", "must not write to stdout");
});

// 9. A malformed payload must never crash the hook.
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
