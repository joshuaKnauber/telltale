import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.ts";
import type { AppState, Commit } from "../types.ts";
import { formatRelative, formatDuration } from "../format.ts";

export function Dashboard() {
  const [state, setState] = useState<AppState | null>(null);
  const [recent, setRecent] = useState<Commit[]>([]);

  useEffect(() => {
    void api.state().then(setState).catch(() => {});
    void api.history().then((r) => setRecent(r.commits.slice(0, 6))).catch(() => {});
  }, []);

  const greeting = makeGreeting(state?.user);
  const blurb = makeBlurb(state);
  const issues = collectIssues(state);

  return (
    <div className="mx-auto w-full max-w-[820px] px-10 pt-16 pb-20">
      <header className="mb-12">
        <h1 className="text-[36px] font-medium leading-[1.1] tracking-[-0.02em]">
          {greeting}
        </h1>
        <p className="mt-3 max-w-[560px] text-[14px] leading-relaxed text-[--color-fg-muted]">
          {blurb}
        </p>
      </header>

      <div className="mb-14 grid grid-cols-4 gap-8">
        <Stat to="/learnings" label="Confirmed" value={state?.counts.confirmed ?? 0} />
        <Stat to="/potential" label="Potential" value={state?.counts.potential ?? 0} />
        <Stat to="/history" label="Commits" value={state?.counts.commits ?? 0} />
        <Stat
          label="Last run"
          value={state?.lastRun.at ? formatRelative(state.lastRun.at) : "—"}
          sub={
            state?.lastRun.elapsedMs != null
              ? formatDuration(state.lastRun.elapsedMs)
              : undefined
          }
        />
      </div>

      <Section title="Recent activity" link={{ to: "/history", label: "View all" }}>
        {recent.length === 0 ? (
          <p className="text-[13.5px] text-[--color-fg-subtle]">No analyzer activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((c) => (
              <li key={c.hash} className="flex items-baseline gap-4 text-[13.5px]">
                <span className="w-[68px] flex-shrink-0 font-mono text-[11px] tabular-nums text-[--color-fg-subtle]">
                  {formatRelative(c.date)}
                </span>
                <span className="flex-1 truncate text-[--color-fg-muted]">{c.message}</span>
                <span className="font-mono text-[11px] text-[--color-fg-subtle]">
                  {c.shortHash}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {issues.length > 0 && (
        <div className="mt-12">
          <SectionLabel>Needs attention</SectionLabel>
          <ul className="mt-3 space-y-2">
            {issues.map((issue, i) => (
              <li key={i} className="text-[13.5px]">
                <Link
                  to="/settings"
                  className="text-[--color-warning] hover:text-[--color-fg]"
                >
                  {issue}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({
  to,
  label,
  value,
  sub,
}: {
  to?: string;
  label: string;
  value: number | string;
  sub?: string;
}) {
  const inner = (
    <>
      <div className="text-[32px] font-medium leading-none tracking-[-0.02em] tabular-nums text-[--color-fg]">
        {value}
      </div>
      <div className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[--color-fg-subtle]">
        {label}
        {sub && <span className="ml-1.5 normal-case tracking-normal">· {sub}</span>}
      </div>
    </>
  );
  if (to) {
    return (
      <Link
        to={to}
        className="block transition-opacity hover:opacity-70"
      >
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}

function Section({
  title,
  link,
  children,
}: {
  title: string;
  link?: { to: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <SectionLabel>{title}</SectionLabel>
        {link && (
          <Link
            to={link.to}
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-[--color-fg-subtle] hover:text-[--color-fg-muted]"
          >
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[--color-fg-subtle]">
      {children}
    </span>
  );
}

function makeGreeting(user?: string): string {
  const name = user ? `, ${user}` : "";
  const h = new Date().getHours();
  if (h < 5) return `Late night${name}`;
  if (h < 12) return `Good morning${name}`;
  if (h < 14) return `Half the day down${name}`;
  if (h < 18) return `Afternoon${name}`;
  if (h < 22) return `Wrapping up${name}`;
  return `Late one${name}`;
}

function makeBlurb(state: AppState | null): string {
  if (!state) return "Loading the latest analyzer state…";
  const { confirmed, potential, commits } = state.counts;
  const parts: string[] = [];

  if (confirmed === 0 && potential === 0) {
    parts.push("Nothing learned yet — the analyzer hasn't found anything durable");
  } else {
    if (confirmed > 0) {
      parts.push(`${confirmed} confirmed learning${confirmed === 1 ? "" : "s"}`);
    } else {
      parts.push("no confirmed learnings yet");
    }
    if (potential > 0) parts.push(`${potential} staged for review`);
  }

  if (commits > 0) parts.push(`${commits} commit${commits === 1 ? "" : "s"} on file`);

  return parts.join(", ") + ".";
}

function collectIssues(state: AppState | null): string[] {
  const issues: string[] = [];
  if (!state) return issues;
  if (!state.hooks.sessionEnd) issues.push("SessionEnd hook is not wired.");
  if (!state.hooks.preCompact) issues.push("PreCompact hook is not wired.");
  return issues;
}
