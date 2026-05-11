import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import { LEARNINGS_FILE, MEMORY_ROOT, POTENTIAL_FILE, TELLTALE_BIN } from "./memory.ts";

const STATE_DIR = join(homedir(), ".claude", "cache", "telltale");
const ANALYZER_LOG = join(STATE_DIR, "analyzer.log");
const ANALYZER_STATE = join(STATE_DIR, "analyzer-state.json");

const MIN_INTERVAL_MS = 5 * 60 * 1000;
const MIN_TRANSCRIPT_BYTES = 4_000;
const ANALYZER_TIMEOUT_MS = 10 * 60 * 1000;

function log(line: string) {
  const stamp = new Date().toISOString();
  writeFileSync(ANALYZER_LOG, `${stamp} ${line}\n`, { flag: "a" });
}

interface AnalyzerState {
  lastRunAt: number;
}

function readState(): AnalyzerState {
  if (!existsSync(ANALYZER_STATE)) return { lastRunAt: 0 };
  try {
    return JSON.parse(readFileSync(ANALYZER_STATE, "utf8"));
  } catch {
    return { lastRunAt: 0 };
  }
}

function writeState(s: AnalyzerState) {
  writeFileSync(ANALYZER_STATE, JSON.stringify(s, null, 2));
}

function buildPrompt(
  transcriptPath: string,
  eventName: string,
  cwd: string
): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are the analyzer for telltale. Review a Claude Code session transcript and update a TWO-STAGE learnings system so future Claude sessions behave better for this user.

# Inputs
- Transcript (JSONL, one event per line): ${transcriptPath}
- Triggering event: ${eventName}
- Project (cwd) where the session ran: ${cwd || "unknown"}
- Today: ${today}

# Files you may edit (and ONLY these)
- ${LEARNINGS_FILE} — confirmed, context-independent preferences. Loaded into EVERY session, so every char costs tokens forever. The file starts with a \`# Learnings\` heading; you write content in the body below it. If the placeholder \`<!-- analyzer writes entries here; ... -->\` comment is present, REPLACE it with your first entry.
- ${POTENTIAL_FILE} — staged observations under verification. Same shape: \`# Potential Learnings\` heading + body. Replace the placeholder comment with content on first write.

DO NOT modify the # heading line. DO NOT touch any other file.

# Two-stage flow
Most observations go to potential-learnings.md FIRST, not learnings.md. A single conversation is weak evidence — a stated preference might be project-specific (e.g. "no Bun" might mean "no Bun for this project," not "user always avoids Bun").

## Promotion criteria (potential → ready for user review)
An entry is READY for the user to confirm when ANY of:
- Observed in ≥2 different projects (cross-project = likely generic).
- Observed ≥3 times across distinct sessions.
- User explicitly confirms it as a general preference.

You DO NOT promote entries directly to ${LEARNINGS_FILE}. Promotion is gated on user approval. Instead, see "Pending review block" below.

## Removal criteria (potential)
Drop an entry from potential-learnings.md when:
- It's been contradicted by a later observation.
- It's gone stale (no new observations across many sessions and never promoted).
- Its \`Status\` is \`rejected\` (the user already declined it). LEAVE rejected entries in place — DO NOT re-stage them as new entries either.

## Step 1 — extract candidate observations from transcript
Look for DURABLE, NON-OBVIOUS signals:
- User preferences, conventions, working style
- Corrections / pushback ("don't do X", "no, instead Y")
- Repeated requests, recurring workflows
- Mental models, terminology

IGNORE: ephemeral task state, code derivable from project, per-conversation context, things already in either file or in CLAUDE.md.

## Step 2 — for each candidate, decide route
- **Direct to learnings.md** ONLY if clearly context-independent (e.g. user explicitly said "I always …", "in every project …", or it's about communication style independent of code). This is RARE.
- **Otherwise → potential-learnings.md.** Default route.

## Step 3 — update potential-learnings.md
For each candidate routed here:
- If a matching entry already exists: append a new context line, increment the count.
- Else: add a new entry.

Entry format:
\`\`\`
### <short title>
- Statement: <one line, written as a future-behavior directive for Claude, NOT as an observation about the user. Use imperative voice. ≤140 chars.>
- Count: <integer>
- Contexts:
  - ${today} — project: <cwd basename> — <brief: where in the conversation this came up, ≤80 chars>
- Status: potential
\`\`\`

GOOD Statements (directive, imperative, future-Claude-facing):
- "When starting a new feature or project, lead with concept/architecture discussion and tradeoffs before writing code."
- "Default to terse responses; skip trailing summaries unless asked."
- "Use Node + tsx; do not introduce Bun without explicit user request."

BAD Statements (observational, user-profiling):
- "User prefers concept discussions before code." → rewrite as directive
- "User dislikes long summaries." → rewrite as "Skip trailing summaries unless asked."
- "User said no Bun." → rewrite as directive (and only if context suggests it's general, not project-specific)

If an existing potential entry's promotion criteria are NOW met, do NOT move it to learnings.md. Instead, refresh the pending-review block (Step 4) so the user gets prompted on their next session.

## Step 4 — pending-review block in learnings.md
Find the candidates whose promotion criteria are met (potential entries with enough evidence, NOT \`Status: rejected\`). If there are any, write/refresh a single block at the very top of ${LEARNINGS_FILE}:

\`\`\`
<!-- telltale:pending-review -->
> NOTE TO CLAUDE: telltale (the local memory tool) has pending learnings awaiting user confirmation.
>
> Timing — DO NOT bring it up immediately. Wait until:
> - the user is not mid-task or actively working through a request, AND
> - either the current topic relates to the candidate, OR the conversation has reached a natural pause (between tasks, after a question is resolved).
> Never derail an active workflow.
>
> Framing — when you do bring it up:
> 1. Attribute it briefly to **telltale** so the user knows the source ("telltale noticed…", "from telltale…"). One short phrase.
> 2. Phrase the change in YOUR OWN VOICE as the new default behavior you'd adopt — what you'll start doing differently. NOT a recitation of the candidate text. One sentence.
> 3. Combined example: "Quick aside — telltale noticed you tend to open new work with a concept discussion. Want me to default to that — talking through approach and tradeoffs before writing code?"
> 4. Ask for a yes / skip. The user can also reject specific items.
>
> On any affirmative, run (do NOT edit files yourself):
>     ${TELLTALE_BIN} promote "<short instruction naming what to promote and/or reject>"
> The command handles file mutations + git commit.
>
> On decline, do not run the command and do not bring it up again this session.
>
> Pending:
> - **<title>**: <statement> (seen in <N> projects, <M> sessions)
<!-- /telltale:pending-review -->
\`\`\`

Rules for the block:
- Always at the very top of the file, before the \`# Learnings\` heading.
- If no candidates qualify, REMOVE any existing block.
- If you're updating an existing block, replace it wholesale with the current candidate list.
- The block is transient — when you read ${LEARNINGS_FILE} to make decisions in Step 5, IGNORE its contents.

## Step 5 — update the body of learnings.md
Bullet list under the \`# Learnings\` heading. Each entry: short rule (≤120 chars). Add parenthetical "(why: …)" only when the reason is non-obvious. Total body ≤50 lines. PREFER UPDATE/REFINE over ADD. REMOVE entries contradicted by the transcript. Every char here is loaded into every future session — be ruthless. (Do NOT add an approved learning here yourself — that's the user's call via the pending-review flow.)

# How to commit
When done (and only if anything actually changed), from ${MEMORY_ROOT}:
\`cd ${MEMORY_ROOT} && git add -A && git commit -m "analyze: <short summary>" || true\`

# Hard constraints
- Be conservative. Bias toward potential over confirmed. Bias toward nothing over potential. Most sessions yield 0–1 changes.
- Only edit the body of the two files; never touch their # headings.
- Do not edit any file outside ${MEMORY_ROOT}.
- Do not edit ~/.claude/CLAUDE.md or settings.json.
- No examples, no rationale paragraphs, no transcript quotes verbatim.

Begin.`;
}

async function main() {
  const transcriptPath = process.argv[2];
  const eventName = process.argv[3] ?? "unknown";
  const cwd = process.argv[4] ?? "";

  if (!transcriptPath) {
    log("error: no transcript path");
    process.exit(1);
  }

  if (!existsSync(transcriptPath)) {
    log(`skip: transcript missing at ${transcriptPath}`);
    process.exit(0);
  }

  const size = statSync(transcriptPath).size;
  if (size < MIN_TRANSCRIPT_BYTES) {
    log(`skip: transcript too small (${size} bytes < ${MIN_TRANSCRIPT_BYTES}) event=${eventName}`);
    process.exit(0);
  }

  const state = readState();
  const now = Date.now();
  const skipCooldown = process.env.TELLTALE_SKIP_COOLDOWN === "1";
  if (!skipCooldown && now - state.lastRunAt < MIN_INTERVAL_MS) {
    log(`skip: last run ${Math.round((now - state.lastRunAt) / 1000)}s ago event=${eventName}`);
    process.exit(0);
  }

  log(`start event=${eventName} cwd=${cwd} transcript=${transcriptPath} bytes=${size}`);

  const prompt = buildPrompt(transcriptPath, eventName, cwd);

  const startedAt = Date.now();
  const result = spawnSync(
    "claude",
    [
      "-p",
      prompt,
      "--permission-mode",
      "bypassPermissions",
      "--add-dir",
      MEMORY_ROOT,
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: ANALYZER_TIMEOUT_MS,
      encoding: "utf8",
      env: { ...process.env, TELLTALE_INTERNAL: "1" },
    }
  );
  const elapsedMs = Date.now() - startedAt;

  if (result.error) {
    log(`error: ${result.error.message} (elapsed=${elapsedMs}ms)`);
    process.exit(1);
  }
  if (result.status !== 0) {
    log(`claude exited ${result.status} (elapsed=${elapsedMs}ms): ${(result.stderr ?? "").slice(0, 300)}`);
    process.exit(1);
  }

  state.lastRunAt = now;
  writeState(state);

  const stdout = result.stdout ?? "";
  const transcriptOut = join(STATE_DIR, `analyzer-stdout-${startedAt}.log`);
  writeFileSync(transcriptOut, stdout);
  log(`done event=${eventName} elapsed=${elapsedMs}ms stdout=${stdout.length}b -> ${transcriptOut}`);
}

main().catch((err) => {
  log(`uncaught: ${(err as Error).message}`);
  process.exit(1);
});
