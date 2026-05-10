export interface AppState {
  user: string;
  paths: {
    learnings: string;
    potential: string;
    memoryRoot: string;
  };
  counts: {
    confirmed: number;
    potential: number;
    commits: number;
  };
  lastRun: {
    at: string | null;
    elapsedMs: number | null;
    event: string | null;
  };
  hooks: {
    sessionEnd: boolean;
    preCompact: boolean;
  };
  version: string;
}

export interface Commit {
  hash: string;
  shortHash: string;
  date: string;
  message: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
}

export interface FileResponse {
  content: string;
  path: string;
}

export type RunStatus = "done" | "running" | "skipped";

export interface Run {
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  event: string;
  elapsedMs: number | null;
  stdoutBytes: number | null;
  stdoutPath: string | null;
  transcriptBytes: number | null;
  cwd: string | null;
  skipReason: string | null;
}
