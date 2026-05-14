import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { homedir, userInfo } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { LEARNINGS_FILE, MEMORY_ROOT, POTENTIAL_FILE, GLOBAL_CLAUDE_MD } from "./memory.ts";

const ANALYZER_LOG = join(homedir(), ".claude", "cache", "telltale", "analyzer.log");
const SETTINGS_JSON = join(homedir(), ".claude", "settings.json");

export interface AppState {
  user: string;
  paths: { learnings: string; potential: string; memoryRoot: string };
  counts: { confirmed: number; potential: number; commits: number };
  lastRun: { at: string | null; elapsedMs: number | null; event: string | null };
  hooks: { sessionEnd: boolean; preCompact: boolean };
  version: string;
}

interface Run {
  startedAt: string;
  finishedAt: string | null;
  status: "done" | "running" | "skipped";
  event: string;
  elapsedMs: number | null;
  stdoutBytes: number | null;
  stdoutPath: string | null;
  transcriptBytes: number | null;
  cwd: string | null;
  skipReason: string | null;
}

interface Commit {
  hash: string;
  shortHash: string;
  date: string;
  message: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
}

function buildApp(uiRoot: string | null): Hono {
  const app = new Hono();

  app.get("/api/state", (c) => c.json(readState()));
  app.get("/api/learnings", (c) => c.json(readFile(LEARNINGS_FILE)));
  app.get("/api/potential", (c) => c.json(readFile(POTENTIAL_FILE)));
  app.get("/api/runs", (c) => c.json({ runs: readRuns() }));
  app.get("/api/history", (c) => c.json({ commits: readHistory() }));

  if (uiRoot) {
    app.use("*", serveStatic({ root: uiRoot }));
    app.notFound((c) => {
      const indexHtml = join(uiRoot, "index.html");
      if (!existsSync(indexHtml)) return c.text("UI not built", 500);
      return c.html(readFileSync(indexHtml, "utf8"));
    });
  }

  return app;
}

export interface StartServerOptions {
  port: number;
  serveUi?: boolean;
}

export async function startServer(opts: StartServerOptions): Promise<void> {
  const uiRoot = opts.serveUi === false ? null : resolveUiRoot();
  if (opts.serveUi !== false && !uiRoot) {
    throw new Error(
      "telltale: UI assets not found. Run `npm run build` (or reinstall) before launching the UI."
    );
  }
  const app = buildApp(uiRoot);
  await new Promise<void>((resolve) => {
    serve({ fetch: app.fetch, port: opts.port }, () => resolve());
  });
}

function resolveUiRoot(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "ui"),
    join(here, "..", "ui", "dist"),
  ];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, "index.html"))) return candidate;
  }
  return null;
}

function readFile(path: string): { content: string; path: string } {
  const content = existsSync(path) ? readFileSync(path, "utf8") : "";
  return { content, path };
}

function readState(): AppState {
  let confirmed = 0;
  let potentialCount = 0;
  let commits = 0;
  let lastRunAt: string | null = null;
  let lastElapsed: number | null = null;
  let lastEvent: string | null = null;
  let sessionEnd = false;
  let preCompact = false;

  if (existsSync(LEARNINGS_FILE)) confirmed = countBullets(readFileSync(LEARNINGS_FILE, "utf8"));
  if (existsSync(POTENTIAL_FILE)) potentialCount = countH3(readFileSync(POTENTIAL_FILE, "utf8"));
  if (existsSync(join(MEMORY_ROOT, ".git"))) {
    try {
      commits = parseInt(
        execSync("git rev-list --count HEAD", { cwd: MEMORY_ROOT, encoding: "utf8" }).trim(),
        10
      ) || 0;
    } catch {
      commits = 0;
    }
  }
  if (existsSync(ANALYZER_LOG)) {
    const tail = readFileSync(ANALYZER_LOG, "utf8").trim().split("\n");
    for (let i = tail.length - 1; i >= 0; i--) {
      const m = tail[i]!.match(/^(\S+) done event=(\S+) elapsed=(\d+)ms/);
      if (m) {
        lastRunAt = m[1]!;
        lastEvent = m[2]!;
        lastElapsed = parseInt(m[3]!, 10);
        break;
      }
    }
  }
  if (existsSync(SETTINGS_JSON)) {
    try {
      const settings = JSON.parse(readFileSync(SETTINGS_JSON, "utf8"));
      sessionEnd = Array.isArray(settings.hooks?.SessionEnd);
      preCompact = Array.isArray(settings.hooks?.PreCompact);
    } catch {
      // ignore
    }
  }

  const claudeMd = existsSync(GLOBAL_CLAUDE_MD) ? readFileSync(GLOBAL_CLAUDE_MD, "utf8") : "";
  const importOk = claudeMd.includes(`@${LEARNINGS_FILE}`);

  return {
    user: prettyName(userInfo().username),
    paths: { learnings: LEARNINGS_FILE, potential: POTENTIAL_FILE, memoryRoot: MEMORY_ROOT },
    counts: { confirmed, potential: potentialCount, commits },
    lastRun: { at: lastRunAt, elapsedMs: lastElapsed, event: lastEvent },
    hooks: { sessionEnd: sessionEnd && importOk, preCompact: preCompact && importOk },
    version: getHeadHash(),
  };
}

function readRuns(): Run[] {
  if (!existsSync(ANALYZER_LOG)) return [];
  const raw = readFileSync(ANALYZER_LOG, "utf8");
  const runs: Run[] = [];
  const pending = new Map<string, Run[]>();

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const tsMatch = line.match(/^(\S+)\s+(.*)$/);
    if (!tsMatch) continue;
    const [, ts, rest] = tsMatch as [string, string, string];

    if (rest.startsWith("start ")) {
      const event = rest.match(/event=(\S+)/)?.[1] ?? "?";
      const cwd = rest.match(/cwd=(\S+)/)?.[1] ?? null;
      const transcriptBytes = +(rest.match(/bytes=(\d+)/)?.[1] ?? 0) || null;
      const run: Run = {
        startedAt: ts,
        finishedAt: null,
        status: "running",
        event,
        elapsedMs: null,
        stdoutBytes: null,
        stdoutPath: null,
        transcriptBytes,
        cwd,
        skipReason: null,
      };
      runs.push(run);
      const queue = pending.get(event) ?? [];
      queue.push(run);
      pending.set(event, queue);
      continue;
    }

    if (rest.startsWith("done ")) {
      const event = rest.match(/event=(\S+)/)?.[1] ?? "?";
      const elapsedMs = +(rest.match(/elapsed=(\d+)ms/)?.[1] ?? 0) || null;
      const stdoutBytes = +(rest.match(/stdout=(\d+)b/)?.[1] ?? 0) || null;
      const stdoutPath = rest.match(/->\s+(\S+)/)?.[1] ?? null;
      const run = pending.get(event)?.shift();
      if (run) {
        run.finishedAt = ts;
        run.status = "done";
        run.elapsedMs = elapsedMs;
        run.stdoutBytes = stdoutBytes;
        run.stdoutPath = stdoutPath;
      } else {
        runs.push({
          startedAt: ts,
          finishedAt: ts,
          status: "done",
          event,
          elapsedMs,
          stdoutBytes,
          stdoutPath,
          transcriptBytes: null,
          cwd: null,
          skipReason: null,
        });
      }
      continue;
    }

    if (rest.startsWith("skip")) {
      const reason = rest.replace(/^skip:\s*/, "").replace(/\s+event=\S+$/, "");
      const event = rest.match(/event=(\S+)/)?.[1] ?? "?";
      runs.push({
        startedAt: ts,
        finishedAt: ts,
        status: "skipped",
        event,
        elapsedMs: null,
        stdoutBytes: null,
        stdoutPath: null,
        transcriptBytes: null,
        cwd: null,
        skipReason: reason,
      });
    }
  }

  return runs.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

function readHistory(): Commit[] {
  if (!existsSync(join(MEMORY_ROOT, ".git"))) return [];
  try {
    const out = execSync(
      "git log --pretty=format:%H%x09%cI%x09%s --shortstat -n 50",
      { cwd: MEMORY_ROOT, encoding: "utf8" }
    );
    return parseGitLog(out);
  } catch {
    return [];
  }
}

function parseGitLog(raw: string): Commit[] {
  const commits: Commit[] = [];
  const lines = raw.split("\n");
  let i = 0;
  while (i < lines.length) {
    const head = lines[i]!.trim();
    if (!head) {
      i++;
      continue;
    }
    const [hash, date, message] = head.split("\t");
    if (!hash || !date) {
      i++;
      continue;
    }
    let filesChanged = 0;
    let insertions = 0;
    let deletions = 0;
    if (i + 1 < lines.length && /file/.test(lines[i + 1]!)) {
      const stat = lines[i + 1]!;
      filesChanged = +(stat.match(/(\d+) file/)?.[1] ?? 0);
      insertions = +(stat.match(/(\d+) insertion/)?.[1] ?? 0);
      deletions = +(stat.match(/(\d+) deletion/)?.[1] ?? 0);
      i++;
    }
    commits.push({
      hash,
      shortHash: hash.slice(0, 7),
      date,
      message: message ?? "",
      filesChanged,
      insertions,
      deletions,
    });
    i++;
  }
  return commits;
}

function countBullets(md: string): number {
  let count = 0;
  for (const line of md.split("\n")) {
    if (line.trim().startsWith("- ")) count++;
  }
  return count;
}

function countH3(md: string): number {
  let count = 0;
  for (const line of md.split("\n")) {
    if (line.trim().startsWith("### ")) count++;
  }
  return count;
}

function prettyName(login: string): string {
  try {
    const gitName = execSync("git config --global user.name", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const first = gitName.split(/\s+/)[0];
    if (first) return first;
  } catch {
    // fall through
  }
  if (!login) return "";
  const parts = login.split(/[._-]/).filter(Boolean);
  const first = parts[0] ?? login;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function getHeadHash(): string {
  if (!existsSync(join(MEMORY_ROOT, ".git"))) return "—";
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: MEMORY_ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    return "—";
  }
}
