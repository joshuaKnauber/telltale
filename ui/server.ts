import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { homedir, userInfo } from "node:os";
import { join } from "node:path";
import type { AppState, Commit, Run } from "./src/types.ts";

const MEMORY_ROOT = join(homedir(), ".telltale");
const LEARNINGS_FILE = join(MEMORY_ROOT, "learnings.md");
const POTENTIAL_FILE = join(MEMORY_ROOT, "potential-learnings.md");
const GLOBAL_CLAUDE_MD = join(homedir(), ".claude", "CLAUDE.md");
const ANALYZER_LOG = join(homedir(), ".claude", "cache", "telltale", "analyzer.log");
const SETTINGS_JSON = join(homedir(), ".claude", "settings.json");

const app = new Hono();

app.get("/api/state", (c) => {
  let confirmed = 0;
  let potentialCount = 0;
  let commits = 0;
  let lastRunAt: string | null = null;
  let lastElapsed: number | null = null;
  let lastEvent: string | null = null;
  let sessionEnd = false;
  let preCompact = false;

  if (existsSync(LEARNINGS_FILE)) {
    confirmed = countBullets(readFileSync(LEARNINGS_FILE, "utf8"));
  }
  if (existsSync(POTENTIAL_FILE)) {
    potentialCount = countH3(readFileSync(POTENTIAL_FILE, "utf8"));
  }
  if (existsSync(join(MEMORY_ROOT, ".git"))) {
    try {
      const out = execSync("git rev-list --count HEAD", { cwd: MEMORY_ROOT, encoding: "utf8" });
      commits = parseInt(out.trim(), 10) || 0;
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

  const state: AppState = {
    user: prettyName(userInfo().username),
    paths: {
      learnings: LEARNINGS_FILE,
      potential: POTENTIAL_FILE,
      memoryRoot: MEMORY_ROOT,
    },
    counts: {
      confirmed,
      potential: potentialCount,
      commits,
    },
    lastRun: {
      at: lastRunAt,
      elapsedMs: lastElapsed,
      event: lastEvent,
    },
    hooks: {
      sessionEnd: sessionEnd && importOk,
      preCompact: preCompact && importOk,
    },
    version: getHeadHash(),
  };
  return c.json(state);
});

app.get("/api/learnings", (c) => {
  const content = existsSync(LEARNINGS_FILE) ? readFileSync(LEARNINGS_FILE, "utf8") : "";
  return c.json({ content, path: LEARNINGS_FILE });
});

app.get("/api/potential", (c) => {
  const content = existsSync(POTENTIAL_FILE) ? readFileSync(POTENTIAL_FILE, "utf8") : "";
  return c.json({ content, path: POTENTIAL_FILE });
});

app.get("/api/runs", (c) => {
  if (!existsSync(ANALYZER_LOG)) return c.json({ runs: [] });
  const raw = readFileSync(ANALYZER_LOG, "utf8");
  return c.json({ runs: parseRuns(raw) });
});

app.get("/api/history", (c) => {
  if (!existsSync(join(MEMORY_ROOT, ".git"))) return c.json({ commits: [] });
  try {
    const out = execSync(
      "git log --pretty=format:%H%x09%cI%x09%s --shortstat -n 50",
      { cwd: MEMORY_ROOT, encoding: "utf8" }
    );
    return c.json({ commits: parseGitLog(out) });
  } catch {
    return c.json({ commits: [] });
  }
});

const PORT = Number(process.env.PORT ?? 5235);
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});

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

function parseRuns(raw: string): Run[] {
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
