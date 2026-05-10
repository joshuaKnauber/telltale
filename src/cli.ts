import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { MEMORY_ROOT } from "./memory.ts";

const SUBCOMMANDS = ["promote"] as const;
type Subcommand = (typeof SUBCOMMANDS)[number];

const HERE = dirname(fileURLToPath(import.meta.url));
const TSX_BIN = resolve(HERE, "..", "node_modules", ".bin", "tsx");
const PROMOTE_WORKER = resolve(HERE, "promote-worker.ts");

const STATE_DIR = join(homedir(), ".claude", "cache", "telltale");
const PROMOTE_LOG = join(STATE_DIR, "promote.log");

function logLine(line: string) {
  mkdirSync(STATE_DIR, { recursive: true });
  const stamp = new Date().toISOString();
  writeFileSync(PROMOTE_LOG, `${stamp} ${line}\n`, { flag: "a" });
}

function usage(): never {
  console.error(`usage: telltale <${SUBCOMMANDS.join("|")}> "<instructions>"`);
  process.exit(2);
}

function spawnPromoteDetached(instructions: string) {
  const child = spawn(TSX_BIN, [PROMOTE_WORKER, instructions], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  logLine(`queued pid=${child.pid} instructions=${JSON.stringify(instructions)}`);
}

function runPromote(instructions: string) {
  if (!instructions.trim()) {
    console.error("error: empty instructions");
    process.exit(2);
  }
  if (!existsSync(MEMORY_ROOT)) {
    console.error(`error: memory root missing at ${MEMORY_ROOT}; run setup first`);
    process.exit(1);
  }
  spawnPromoteDetached(instructions);
  console.log(`telltale: promote queued (will run in background; tail ${PROMOTE_LOG} for status)`);
  process.exit(0);
}

function main() {
  const [sub, ...rest] = process.argv.slice(2);
  if (!sub || !SUBCOMMANDS.includes(sub as Subcommand)) usage();
  const instructions = rest.join(" ");
  if (sub === "promote") runPromote(instructions);
}

main();
