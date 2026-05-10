import type { AppState, Commit, FileResponse, Run } from "./types.ts";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  state: () => get<AppState>("/api/state"),
  learnings: () => get<FileResponse>("/api/learnings"),
  potential: () => get<FileResponse>("/api/potential"),
  history: () => get<{ commits: Commit[] }>("/api/history"),
  runs: () => get<{ runs: Run[] }>("/api/runs"),
};
