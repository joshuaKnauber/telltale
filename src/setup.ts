import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
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

export function runSetup(opts: { skipScan: boolean; limit: number }) {
  console.log("telltale setup\n");
  ensureMemoryDir();
  ensureLearningsFile();
  ensurePotentialFile();
  ensureGitRepo();
  ensureClaudeMdImport();
  console.log("\nSetup complete.");
  if (!opts.skipScan) runInitialScan(opts.limit);
}
