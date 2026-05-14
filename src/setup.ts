import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  GLOBAL_CLAUDE_MD,
  IMPORT_LINE,
  IMPORT_MARKER,
  INITIAL_LEARNINGS,
  INITIAL_POTENTIAL,
  LEARNINGS_FILE,
  MEMORY_ROOT,
  POTENTIAL_FILE,
} from "./memory.ts";
import { runInitialScan } from "./initial-scan.ts";
import { runReview } from "./review-ui.ts";

const CLAUDE_SETTINGS = join(homedir(), ".claude", "settings.json");
const HOOK_EVENTS = ["SessionEnd", "PreCompact"] as const;
const HOOK_COMMAND = "telltale __hook";
const HOOK_TIMEOUT = 30;

interface HookEntry {
  type?: string;
  command?: string;
  timeout?: number;
  [k: string]: unknown;
}
interface MatcherGroup {
  matcher?: string;
  hooks?: HookEntry[];
  [k: string]: unknown;
}
interface SettingsJson {
  hooks?: Record<string, MatcherGroup[]>;
  [k: string]: unknown;
}

function step(msg: string) {
  console.log(`• ${msg}`);
}

function ensureMemoryDir() {
  mkdirSync(MEMORY_ROOT, { recursive: true });
  step(`memory dir ready: ${MEMORY_ROOT}`);
}

function ensureLearningsFile() {
  if (existsSync(LEARNINGS_FILE)) {
    step(`learnings.md already exists, leaving as-is`);
    return;
  }
  writeFileSync(LEARNINGS_FILE, INITIAL_LEARNINGS);
  step(`created learnings.md`);
}

function ensurePotentialFile() {
  if (existsSync(POTENTIAL_FILE)) {
    step(`potential-learnings.md already exists, leaving as-is`);
    return;
  }
  writeFileSync(POTENTIAL_FILE, INITIAL_POTENTIAL);
  step(`created potential-learnings.md`);
}

function ensureGitRepo() {
  const gitDir = `${MEMORY_ROOT}/.git`;
  if (existsSync(gitDir)) {
    step(`git repo already initialized`);
    return;
  }
  execSync(`git init -q -b main`, { cwd: MEMORY_ROOT });
  execSync(`git add -A`, { cwd: MEMORY_ROOT });
  try {
    execSync(`git commit -q -m "initial: scaffold by telltale setup"`, {
      cwd: MEMORY_ROOT,
    });
  } catch {
    // empty commit fine
  }
  step(`git initialized at ${gitDir}`);
}

function ensureClaudeMdImport() {
  let existing = "";
  if (existsSync(GLOBAL_CLAUDE_MD)) {
    existing = readFileSync(GLOBAL_CLAUDE_MD, "utf8");
  }

  const desiredBlock = `${IMPORT_MARKER}\n${IMPORT_LINE}`;

  if (existing.includes(IMPORT_MARKER)) {
    const lines = existing.split("\n");
    const markerIdx = lines.findIndex((l) => l.trim() === IMPORT_MARKER);
    const oldImportLine = lines[markerIdx + 1] ?? "";
    if (oldImportLine === IMPORT_LINE) {
      step(`@import already correct in ${GLOBAL_CLAUDE_MD}`);
      return;
    }
    lines[markerIdx + 1] = IMPORT_LINE;
    writeFileSync(GLOBAL_CLAUDE_MD, lines.join("\n"));
    step(`updated existing @import line in ${GLOBAL_CLAUDE_MD}`);
    return;
  }

  const sep = !existing || existing.endsWith("\n") ? "" : "\n";
  writeFileSync(GLOBAL_CLAUDE_MD, `${existing}${sep}\n${desiredBlock}\n`);
  step(`appended @import to ${GLOBAL_CLAUDE_MD}`);
}

function ensureClaudeHooks() {
  let raw = "";
  if (existsSync(CLAUDE_SETTINGS)) {
    raw = readFileSync(CLAUDE_SETTINGS, "utf8");
  }

  let settings: SettingsJson = {};
  if (raw.trim()) {
    try {
      settings = JSON.parse(raw);
    } catch {
      step(`warning: ${CLAUDE_SETTINGS} is not valid JSON; skipping hook install. Add manually:`);
      console.log(`    SessionEnd, PreCompact → command "${HOOK_COMMAND}"`);
      return;
    }
  }

  mkdirSync(join(homedir(), ".claude"), { recursive: true });
  settings.hooks = settings.hooks ?? {};

  const ourGroup: MatcherGroup = {
    matcher: "",
    hooks: [{ type: "command", command: HOOK_COMMAND, timeout: HOOK_TIMEOUT }],
  };

  let changed = false;
  for (const evt of HOOK_EVENTS) {
    const existing = settings.hooks[evt] ?? [];
    const others = existing.filter(
      (g) => !(g.hooks ?? []).some((h) => (h.command ?? "").includes("telltale"))
    );
    const next = [...others, ourGroup];
    if (JSON.stringify(existing) !== JSON.stringify(next)) {
      settings.hooks[evt] = next;
      changed = true;
    }
  }

  if (!changed) {
    step(`hooks already installed in ${CLAUDE_SETTINGS}`);
    return;
  }

  writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2) + "\n");
  step(`installed SessionEnd + PreCompact hooks in ${CLAUDE_SETTINGS}`);

  const onPath = spawnSync("which", ["telltale"], { stdio: "ignore" }).status === 0;
  if (!onPath) {
    step(
      `warning: 'telltale' is not on PATH; hooks will fail until you 'npm i -g @jknauber/telltale' (or 'npm link' in dev).`
    );
  }
}

export async function runSetup(opts: { skipScan: boolean; limit: number }) {
  console.log("telltale setup\n");
  ensureMemoryDir();
  ensureLearningsFile();
  ensurePotentialFile();
  ensureGitRepo();
  ensureClaudeMdImport();
  ensureClaudeHooks();
  console.log("\nSetup complete.");
  if (opts.skipScan) return;
  runInitialScan(opts.limit);
  await runReview();
}
