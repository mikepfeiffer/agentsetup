import { fileURLToPath } from "node:url";
import { Ledger } from "./ledger.js";
import { formatCents } from "./money.js";

/**
 * Minimal demo CLI:
 *   payments-app charge <requestId> <amountCents> [<requestId> <amountCents> ...]
 *
 * Charges each (requestId, amountCents) pair against a fresh ledger and prints
 * the running result, then the total. Idempotent: repeating a requestId does not
 * double-charge. Returns a process exit code.
 */
export function run(argv: string[]): number {
  const [command, ...rest] = argv;
  if (command !== "charge" || rest.length === 0 || rest.length % 2 !== 0) {
    process.stderr.write(
      "usage: payments-app charge <requestId> <amountCents> " +
        "[<requestId> <amountCents> ...]\n"
    );
    return 1;
  }

  const ledger = new Ledger();
  try {
    for (let i = 0; i < rest.length; i += 2) {
      const requestId = rest[i];
      const amountCents = Number(rest[i + 1]);
      const result = ledger.charge({ requestId, amountCents });
      process.stdout.write(
        `${result.status}: ${requestId} -> ${formatCents(result.amountCents)}\n`
      );
    }
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 1;
  }

  process.stdout.write(`total: ${formatCents(ledger.total())}\n`);
  return 0;
}

// Run only when executed directly, not when imported by tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(run(process.argv.slice(2)));
}
