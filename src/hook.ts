import { log } from "./state.ts";
import { spawnSelfDetached } from "./self-spawn.ts";

interface HookInput {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  hook_event_name?: string;
  trigger?: string;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function spawnAnalyzerDetached(transcriptPath: string, eventName: string, cwd: string) {
  const child = spawnSelfDetached(["__analyze", transcriptPath, eventName, cwd]);
  log(`spawned analyzer pid=${child.pid} event=${eventName}`);
}

export async function runHookEntry(): Promise<void> {
  if (process.env.TELLTALE_INTERNAL === "1") {
    log(`skip: TELLTALE_INTERNAL=1 (internal claude run, suppressing recursive hook)`);
    return;
  }

  let input: HookInput = {};
  try {
    const raw = await readStdin();
    if (raw.trim()) input = JSON.parse(raw);
  } catch (err) {
    log(`failed to parse stdin: ${(err as Error).message}`);
    return;
  }

  const event = input.hook_event_name ?? "?";
  const project = input.cwd ?? "unknown";
  log(
    `fired event=${event} session=${input.session_id ?? "?"} cwd=${project} transcript=${input.transcript_path ?? "?"}${input.trigger ? ` trigger=${input.trigger}` : ""}`
  );

  if (!input.transcript_path) {
    log("skip: no transcript_path");
    return;
  }

  spawnAnalyzerDetached(input.transcript_path, event, project);
}
