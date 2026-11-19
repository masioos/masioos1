#!/usr/bin/env node
// `pnpm setup:local` — first-time setup on a new machine (Windows, macOS, Linux).
// 1. copies .env.example to .env if .env is missing
// 2. starts the Postgres container (needs Docker Desktop running)
// 3. applies the database migrations

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";

const isWin = process.platform === "win32";
const run = (cmd, args) => {
  const res = spawnSync(isWin && cmd === "pnpm" ? "pnpm.cmd" : cmd, args, {
    stdio: "inherit",
    shell: isWin,
  });
  if (res.status !== 0) {
    console.error(`\n✖ "${cmd} ${args.join(" ")}" failed.`);
    if (cmd === "docker") console.error("  Is Docker Desktop open and running?");
    process.exit(res.status ?? 1);
  }
};

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("✔ created .env from .env.example");
}
run("docker", ["compose", "up", "-d", "--wait", "db"]);
run("pnpm", ["db:migrate"]);
console.log("\n✔ ready. Run: pnpm dev  → open http://localhost:3000");
