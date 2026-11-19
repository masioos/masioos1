#!/usr/bin/env node
// Stop hook: before Claude ends a turn, run `pnpm check` if code changed.
// A failure exits 2; Claude Code shows the output to Claude, which keeps working to fix it.
// Ceiling: when stop_hook_active is set (Claude is already fixing a failure from this hook),
// it exits 0, so a check Claude cannot fix never loops forever. /ship still runs the check.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const isWin = process.platform === "win32";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {}
if (input.stop_hook_active) process.exit(0);

const cwd = input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const status = spawnSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8" });
const codeChanged = (status.stdout ?? "")
  .split("\n")
  .some((line) => /\.(ts|tsx|mjs|mts|css)$/.test(line.trim()));
if (!codeChanged) process.exit(0);

const res = spawnSync(isWin ? "pnpm.cmd" : "pnpm", ["check"], {
  cwd,
  encoding: "utf8",
  shell: isWin,
});
if (res.status === 0) process.exit(0);

const out = `${res.stdout ?? ""}\n${res.stderr ?? ""}`.trim().split("\n").slice(-60).join("\n");
console.error(`pnpm check failed. Fix it before you say the work is done.\n\n${out}`);
process.exit(2);
