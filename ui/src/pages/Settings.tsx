import { useEffect, useState } from "react";
import { api } from "../api.ts";
import type { AppState } from "../types.ts";
import { formatRelative, formatDuration } from "../format.ts";

export function Settings() {
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    void api.state().then(setState).catch(() => {});
  }, []);

  return (
    <div className="mx-auto w-full max-w-[720px] px-10 pt-16 pb-20">
      <header className="mb-12">
        <h1 className="text-[28px] font-medium leading-tight tracking-[-0.02em]">Settings</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[--color-fg-muted]">
          Read-only snapshot of the analyzer wiring.
        </p>
      </header>

      <Section title="Last run">
        <Row label="When" value={state?.lastRun.at ? formatRelative(state.lastRun.at) : "never"} />
        <Row
          label="Duration"
          value={state?.lastRun.elapsedMs != null ? formatDuration(state.lastRun.elapsedMs) : "—"}
        />
        <Row label="Trigger" value={state?.lastRun.event ?? "—"} />
      </Section>

      <Section title="Hooks">
        <Row
          label="SessionEnd"
          value={state ? <Status wired={state.hooks.sessionEnd} /> : "—"}
        />
        <Row
          label="PreCompact"
          value={state ? <Status wired={state.hooks.preCompact} /> : "—"}
        />
      </Section>

      <Section title="Paths">
        <Row label="Memory root" value={<Mono>{state?.paths.memoryRoot}</Mono>} />
        <Row label="Learnings" value={<Mono>{state?.paths.learnings}</Mono>} />
        <Row label="Potential" value={<Mono>{state?.paths.potential}</Mono>} />
      </Section>

      <Section title="Version" last>
        <Row label="UI" value={<Mono>v0.1</Mono>} />
        <Row label="Build" value={<Mono>{state?.version ?? "—"}</Mono>} />
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <section className={last ? "" : "mb-10"}>
      <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[--color-fg-subtle]">
        {title}
      </h2>
      <dl className="space-y-2.5">{children}</dl>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-6">
      <dt className="w-[120px] flex-shrink-0 text-[13px] text-[--color-fg-muted]">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-[13px] text-[--color-fg]">{value}</dd>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[12px]">{children ?? "—"}</span>;
}

function Status({ wired }: { wired: boolean }) {
  return (
    <span
      className={`font-mono text-[11px] uppercase tracking-[0.14em] ${
        wired ? "text-[--color-accent]" : "text-[--color-warning]"
      }`}
    >
      {wired ? "wired" : "missing"}
    </span>
  );
}
