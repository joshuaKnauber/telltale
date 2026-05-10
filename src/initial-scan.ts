import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TSX_BIN = resolve(HERE, "..", "node_modules", ".bin", "tsx");
const ANALYZER_PATH = resolve(HERE, "analyzer.ts");

const PROJECTS_DIR = join(homedir(), ".claude", "projects");
const MIN_TRANSCRIPT_BYTES = 4_000;

interface Transcript {
  path: string;
  project: string;
  cwd: string;
  size: number;
  mtime: number;
}

function decodeProjectDir(name: string): string {
  return name.startsWith("-") ? "/" + name.slice(1).replace(/-/g, "/") : name;
}

function discoverTranscripts(): Transcript[] {
  if (!existsSync(PROJECTS_DIR)) return [];
  const result: Transcript[] = [];
  for (const projectName of readdirSync(PROJECTS_DIR)) {
    const projectDir = join(PROJECTS_DIR, projectName);
    let entries: string[];
    try {
      entries = readdirSync(projectDir);
    } catch {
      continue;
    }
    for (const fname of entries) {
      if (!fname.endsWith(".jsonl")) continue;
      const path = join(projectDir, fname);
      let s;
      try {
        s = statSync(path);
      } catch {
        continue;
      }
      if (s.size < MIN_TRANSCRIPT_BYTES) continue;
      result.push({
        path,
        project: projectName,
        cwd: decodeProjectDir(projectName),
        size: s.size,
        mtime: s.mtimeMs,
      });
    }
  }
  return result;
}

function shortName(t: Transcript): string {
  const base = t.path.split("/").pop() ?? t.path;
  const session = base.replace(/\.jsonl$/, "").slice(0, 8);
  return `${t.project.slice(-40)} · ${session}`;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n}b`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}kb`;
  return `${(n / (1024 * 1024)).toFixed(1)}mb`;
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)
    .toString()
    .padStart(2, "0")}s`;
}

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function startSpinner(label: () => string): () => void {
  if (!process.stdout.isTTY) {
    process.stdout.write(`  ${label()}\n`);
    return () => {};
  }
  let i = 0;
  const tick = () => {
    const frame = SPINNER[i++ % SPINNER.length];
    process.stdout.write(`\r  ${frame} ${label()}`);
  };
  tick();
  const handle = setInterval(tick, 80);
  return () => {
    clearInterval(handle);
    process.stdout.write("\r\x1b[2K");
  };
}

function runOne(t: Transcript): { ok: boolean; elapsedMs: number; status: number | null } {
  const startedAt = Date.now();
  const result = spawnSync(
    TSX_BIN,
    [ANALYZER_PATH, t.path, "InitialScan", t.cwd],
    {
      env: { ...process.env, TELLTALE_SKIP_COOLDOWN: "1" },
      stdio: ["ignore", "ignore", "pipe"],
      encoding: "utf8",
    }
  );
  const elapsedMs = Date.now() - startedAt;
  return {
    ok: !result.error && result.status === 0,
    elapsedMs,
    status: result.status,
  };
}

export function runInitialScan(limit: number): void {
  const all = discoverTranscripts();
  if (all.length === 0) {
    console.log("\nInitial scan: no eligible transcripts found.");
    return;
  }

  const sorted = all.sort((a, b) => b.mtime - a.mtime);
  const safeLimit = Math.max(0, Math.floor(limit));
  const picked = sorted.slice(0, safeLimit);

  console.log(
    `\nInitial scan: ${all.length} eligible transcript${all.length === 1 ? "" : "s"} found, analyzing ${picked.length} most recent.\n`
  );

  let okCount = 0;
  let failCount = 0;
  const totalStart = Date.now();

  for (let idx = 0; idx < picked.length; idx++) {
    const t = picked[idx]!;
    const tag = `[${idx + 1}/${picked.length}]`;
    const sessionStart = Date.now();
    const stop = startSpinner(
      () =>
        `${tag} ${shortName(t)} (${fmtBytes(t.size)}) · ${fmtDuration(Date.now() - sessionStart)}`
    );
    const r = runOne(t);
    stop();

    if (r.ok) {
      okCount++;
      console.log(`  ✓ ${tag} ${shortName(t)} · ${fmtDuration(r.elapsedMs)}`);
    } else {
      failCount++;
      console.log(
        `  ✗ ${tag} ${shortName(t)} · ${fmtDuration(r.elapsedMs)} · status=${r.status}`
      );
    }
  }

  console.log(
    `\nDone in ${fmtDuration(Date.now() - totalStart)} — ${okCount} ok, ${failCount} failed.`
  );
}
