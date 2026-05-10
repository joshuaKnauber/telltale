import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

const STATE_DIR = join(homedir(), ".claude", "cache", "telltale");
const LOG_FILE = join(STATE_DIR, "hook.log");

export function ensureStateDir() {
  mkdirSync(STATE_DIR, { recursive: true });
}

export function log(line: string) {
  ensureStateDir();
  const stamp = new Date().toISOString();
  writeFileSync(LOG_FILE, `${stamp} ${line}\n`, { flag: "a" });
}

export { STATE_DIR, LOG_FILE };
