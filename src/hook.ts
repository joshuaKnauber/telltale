import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { log } from "./state.ts";

interface HookInput {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  hook_event_name?: string;
  trigger?: string;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const ANALYZER_PATH = resolve(HERE, "analyzer.ts");
const TSX_BIN = resolve(HERE, "..", "node_modules", ".bin", "tsx");

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function spawnAnalyzerDetached(transcriptPath: string, eventName: string, cwd: string) {
  const child = spawn(
    TSX_BIN,
    [ANALYZER_PATH, transcriptPath, eventName, cwd],
    {
      detached: true,
      stdio: "ignore",
    }
  );
  child.unref();
  log(`spawned analyzer pid=${child.pid} event=${eventName}`);
}

async function main() {
  let input: HookInput = {};
  try {
    const raw = await readStdin();
    if (raw.trim()) input = JSON.parse(raw);
  } catch (err) {
    log(`failed to parse stdin: ${(err as Error).message}`);
    process.exit(0);
  }

  const event = input.hook_event_name ?? "?";
  const project = input.cwd ?? "unknown";
  log(
    `fired event=${event} session=${input.session_id ?? "?"} cwd=${project} transcript=${input.transcript_path ?? "?"}${input.trigger ? ` trigger=${input.trigger}` : ""}`
  );

  if (!input.transcript_path) {
    log("skip: no transcript_path");
    process.exit(0);
  }

  spawnAnalyzerDetached(input.transcript_path, event, project);
  process.exit(0);
}

main().catch((err) => {
  log(`uncaught: ${(err as Error).message}`);
  process.exit(0);
});
