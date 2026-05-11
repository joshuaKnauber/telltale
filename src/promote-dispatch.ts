import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSelfDetached } from "./self-spawn.ts";

const STATE_DIR = join(homedir(), ".claude", "cache", "telltale");
export const PROMOTE_LOG = join(STATE_DIR, "promote.log");

function logLine(line: string) {
  mkdirSync(STATE_DIR, { recursive: true });
  const stamp = new Date().toISOString();
  writeFileSync(PROMOTE_LOG, `${stamp} ${line}\n`, { flag: "a" });
}

export function dispatchPromote(instructions: string): number | undefined {
  const child = spawnSelfDetached(["__promote", instructions]);
  logLine(`queued pid=${child.pid} instructions=${JSON.stringify(instructions).slice(0, 300)}`);
  return child.pid;
}
