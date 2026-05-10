import { useEffect, useState } from "react";
import { api } from "../api.ts";
import type { Run } from "../types.ts";
import { formatDateTime, formatDuration } from "../format.ts";

export function Runs() {
  const [runs, setRuns] = useState<Run[] | null>(null);

  useEffect(() => {
    void api.runs().then((r) => setRuns(r.runs)).catch(() => setRuns([]));
  }, []);

  if (!runs) return null;

  return (
    <div className="mx-auto w-full max-w-[820px] px-10 pt-16 pb-20">
      <header className="mb-10">
        <h1 className="text-[28px] font-medium leading-tight tracking-[-0.02em]">Runs</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[--color-fg-muted]">
          Every analyzer kick-off, completion, and debounced skip — newest first.
        </p>
      </header>

      {runs.length === 0 ? (
        <p className="text-[13.5px] text-[--color-fg-muted]">No runs logged yet.</p>
      ) : (
        <ol className="space-y-5">
          {runs.map((r, i) => (
            <RunRow key={`${r.startedAt}-${i}`} run={r} />
          ))}
        </ol>
      )}
    </div>
  );
}

function RunRow({ run }: { run: Run }) {
  const meta: string[] = [];
  if (run.cwd) meta.push(prettyPath(run.cwd));
  if (run.transcriptBytes != null) meta.push(`${formatBytes(run.transcriptBytes)} transcript`);
  if (run.stdoutBytes != null) meta.push(`wrote ${run.stdoutBytes}b`);
  if (run.skipReason) meta.push(run.skipReason);

  return (
    <li className="flex items-baseline gap-6">
      <span className="w-[120px] flex-shrink-0 font-mono text-[11px] tabular-nums text-[--color-fg-subtle]">
        {formatDateTime(run.startedAt)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-3 text-[14px]">
          <StatusTag status={run.status} />
          <span className="text-[--color-fg]">{run.event}</span>
          {run.elapsedMs != null && (
            <span className="font-mono text-[11px] tabular-nums text-[--color-fg-subtle]">
              {formatDuration(run.elapsedMs)}
            </span>
          )}
        </p>
        {meta.length > 0 && (
          <p className="mt-1 truncate font-mono text-[11px] text-[--color-fg-subtle]">
            {meta.join("  ·  ")}
          </p>
        )}
      </div>
    </li>
  );
}

function prettyPath(p: string): string {
  return p.replace(/^\/Users\/[^/]+/, "~");
}

function StatusTag({ status }: { status: Run["status"] }) {
  const map = {
    done: "text-[--color-accent]",
    running: "text-[--color-info]",
    skipped: "text-[--color-fg-subtle]",
  } as const;
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.14em] ${map[status]}`}
    >
      {status}
    </span>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}b`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}kb`;
  return `${(n / (1024 * 1024)).toFixed(1)}mb`;
}
