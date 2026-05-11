import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { LEARNINGS_FILE, MEMORY_ROOT, POTENTIAL_FILE } from "./memory.ts";

const STATE_DIR = join(homedir(), ".claude", "cache", "telltale");
const PROMOTE_LOG = join(STATE_DIR, "promote.log");
const PROMOTE_TIMEOUT_MS = 5 * 60 * 1000;

function log(line: string) {
  mkdirSync(STATE_DIR, { recursive: true });
  const stamp = new Date().toISOString();
  writeFileSync(PROMOTE_LOG, `${stamp} ${line}\n`, { flag: "a" });
}

function buildPrompt(instructions: string): string {
  return `You are the promotion worker for telltale. The user just approved (and possibly rejected) some pending learnings during a Claude Code session. Apply their decision to the on-disk files.

# Files
- Confirmed learnings (loaded into every session): ${LEARNINGS_FILE}
- Potential staging file: ${POTENTIAL_FILE}
- Memory root (git repo): ${MEMORY_ROOT}

# User's instruction (free-text from the in-session Claude)
${instructions}

# What to do
Interpret the instruction. For each item the user wants to PROMOTE:
1. Find the matching \`### <title>\` entry in ${POTENTIAL_FILE} (be tolerant: title may be paraphrased).
2. Append the entry's \`Statement\` line as a new bullet under the \`# Learnings\` heading in ${LEARNINGS_FILE}. Format: \`- <statement>\` (≤140 chars; trim if needed; preserve directive voice).
3. Remove the matched entry from ${POTENTIAL_FILE}.

For each item the user wants to REJECT:
1. Find the matching \`### <title>\` entry in ${POTENTIAL_FILE}.
2. Change its \`- Status:\` line to \`- Status: rejected\` (do not delete — the analyzer needs it to avoid re-staging).

After all edits:
- If ${LEARNINGS_FILE} contains a \`<!-- telltale:pending-review -->\` … \`<!-- /telltale:pending-review -->\` block, remove the entire block (HTML comments included).
- Commit both files: \`cd ${MEMORY_ROOT} && git add -A && git commit -m "promote: <one-line summary>" || true\`

# Hard rules
- Do NOT modify the \`# Learnings\` or \`# Potential Learnings\` heading lines.
- Do NOT touch any file outside ${MEMORY_ROOT}.
- Do NOT change other learning entries — only the ones the user named.
- If the instruction is ambiguous, do nothing and explain why on stdout.

Begin.`;
}

export function runPromoteWorkerEntry(argv: string[]): void {
  const instructions = argv[0] ?? "";
  if (!instructions.trim()) {
    log("error: empty instructions");
    process.exit(1);
  }

  const startedAt = Date.now();
  log(`start instructions=${JSON.stringify(instructions).slice(0, 200)}`);

  const result = spawnSync(
    "claude",
    [
      "-p",
      buildPrompt(instructions),
      "--permission-mode",
      "bypassPermissions",
      "--add-dir",
      MEMORY_ROOT,
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: PROMOTE_TIMEOUT_MS,
      encoding: "utf8",
      env: { ...process.env, TELLTALE_INTERNAL: "1" },
    }
  );

  const elapsedMs = Date.now() - startedAt;

  if (result.error) {
    log(`error: ${result.error.message} elapsed=${elapsedMs}ms`);
    process.exit(1);
  }
  if (result.status !== 0) {
    log(`claude exited ${result.status} elapsed=${elapsedMs}ms stderr=${(result.stderr ?? "").slice(0, 300)}`);
    process.exit(1);
  }

  const stdout = result.stdout ?? "";
  const stdoutFile = join(STATE_DIR, `promote-stdout-${startedAt}.log`);
  writeFileSync(stdoutFile, stdout);
  log(`done elapsed=${elapsedMs}ms stdout=${stdout.length}b -> ${stdoutFile}`);
}
