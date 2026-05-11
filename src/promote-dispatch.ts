import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TSX_BIN = resolve(HERE, "..", "node_modules", ".bin", "tsx");
const PROMOTE_WORKER = resolve(HERE, "promote-worker.ts");

const STATE_DIR = join(homedir(), ".claude", "cache", "telltale");
export const PROMOTE_LOG = join(STATE_DIR, "promote.log");

function logLine(line: string) {
  mkdirSync(STATE_DIR, { recursive: true });
  const stamp = new Date().toISOString();
  writeFileSync(PROMOTE_LOG, `${stamp} ${line}\n`, { flag: "a" });
}

export function dispatchPromote(instructions: string): number | undefined {
  const child = spawn(TSX_BIN, [PROMOTE_WORKER, instructions], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  logLine(`queued pid=${child.pid} instructions=${JSON.stringify(instructions).slice(0, 300)}`);
  return child.pid;
}
