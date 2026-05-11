import {
  spawn,
  spawnSync,
  type SpawnOptions,
  type SpawnSyncOptions,
  type SpawnSyncReturns,
} from "node:child_process";
import { dirname, resolve } from "node:path";

const ENTRY = process.argv[1] ?? "";

function resolveInvocation(): { cmd: string; prefix: string[] } {
  if (ENTRY.endsWith(".ts")) {
    const tsx = resolve(dirname(ENTRY), "..", "node_modules", ".bin", "tsx");
    return { cmd: tsx, prefix: [ENTRY] };
  }
  return { cmd: process.execPath, prefix: [ENTRY] };
}

export function spawnSelf(
  args: string[],
  opts: SpawnSyncOptions = {}
): SpawnSyncReturns<string> {
  const { cmd, prefix } = resolveInvocation();
  return spawnSync(cmd, [...prefix, ...args], {
    encoding: "utf8",
    ...opts,
  }) as SpawnSyncReturns<string>;
}

export function spawnSelfDetached(args: string[], opts: SpawnOptions = {}) {
  const { cmd, prefix } = resolveInvocation();
  const child = spawn(cmd, [...prefix, ...args], {
    detached: true,
    stdio: "ignore",
    ...opts,
  });
  child.unref();
  return child;
}
