#!/usr/bin/env node
// `pnpm check` — the one gate. Runs on Windows, macOS and Linux (Node only, no bash).
// Order: typecheck → lint → tests. Stops at the first failure and exits non-zero.
// Lint warnings (module boundaries) are printed but do not fail; /ship refuses to merge with any.

import { spawnSync } from "node:child_process";

const steps = [
  // `next typegen` writes the route types (LayoutProps, PageProps) that tsc needs.
  ["typegen", ["exec", "next", "typegen"]],
  ["typecheck", ["exec", "tsc", "--noEmit"]],
  ["lint", ["exec", "eslint"]],
  ["test", ["exec", "vitest", "run"]],
];

const isWin = process.platform === "win32";

for (const [name, args] of steps) {
  console.log(`\n▶ ${name}`);
  const res = spawnSync(isWin ? "pnpm.cmd" : "pnpm", args, { stdio: "inherit", shell: isWin });
  if (res.status !== 0) {
    console.error(`\n✖ ${name} failed`);
    process.exit(res.status ?? 1);
  }
}
console.log("\n✔ all checks passed");
