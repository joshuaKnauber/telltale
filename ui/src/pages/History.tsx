import { useEffect, useState } from "react";
import { api } from "../api.ts";
import type { Commit } from "../types.ts";
import { formatDateTime } from "../format.ts";

export function History() {
  const [commits, setCommits] = useState<Commit[] | null>(null);

  useEffect(() => {
    void api.history().then((r) => setCommits(r.commits)).catch(() => setCommits([]));
  }, []);

  if (!commits) return null;

  return (
    <div className="mx-auto w-full max-w-[760px] px-10 pt-16 pb-20">
      <header className="mb-10">
        <h1 className="text-[28px] font-medium leading-tight tracking-[-0.02em]">History</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[--color-fg-muted]">
          Every analyzer write is committed. Browse the timeline below.
        </p>
      </header>

      {commits.length === 0 ? (
        <p className="text-[13.5px] text-[--color-fg-muted]">
          No history yet. Each analyzer run commits its changes.
        </p>
      ) : (
        <ol className="space-y-5">
          {commits.map((c) => (
            <li key={c.hash} className="flex items-baseline gap-6">
              <span className="w-[120px] flex-shrink-0 font-mono text-[11px] tabular-nums text-[--color-fg-subtle]">
                {formatDateTime(c.date)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] text-[--color-fg]">{c.message}</p>
                <p className="mt-1 flex items-center gap-3 font-mono text-[11px] text-[--color-fg-subtle]">
                  <span>{c.shortHash}</span>
                  <span>·</span>
                  <span>
                    {c.filesChanged} file{c.filesChanged === 1 ? "" : "s"}
                  </span>
                  {c.insertions > 0 && (
                    <span className="text-[--color-accent]">+{c.insertions}</span>
                  )}
                  {c.deletions > 0 && (
                    <span className="text-[--color-danger]">−{c.deletions}</span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
