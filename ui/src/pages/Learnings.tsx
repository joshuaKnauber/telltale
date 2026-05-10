import { useEffect, useState } from "react";
import { api } from "../api.ts";
import { Markdown } from "../Markdown.tsx";
import { isMarkdownEmpty } from "../md.ts";

export function Learnings() {
  const [data, setData] = useState<{ content: string; path: string } | null>(null);

  useEffect(() => {
    void api.learnings().then(setData).catch(() => {});
  }, []);

  return (
    <PageShell
      title="Learnings"
      blurb="Confirmed, context-independent preferences. Loaded into every Claude Code session."
      path={data?.path}
    >
      {data && isMarkdownEmpty(data.content) ? (
        <Empty>
          Observations get staged in <span className="font-mono">potential</span> first. Once an
          observation is seen across two projects or three sessions, the analyzer promotes it here.
        </Empty>
      ) : data ? (
        <Markdown>{stripTopHeading(data.content)}</Markdown>
      ) : null}
    </PageShell>
  );
}

export function PageShell({
  title,
  blurb,
  path,
  children,
}: {
  title: string;
  blurb: string;
  path?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[720px] px-10 pt-16 pb-20">
      <header className="mb-10">
        <h1 className="text-[28px] font-medium leading-tight tracking-[-0.02em]">{title}</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[--color-fg-muted]">{blurb}</p>
        {path && (
          <p className="mt-3 font-mono text-[11px] text-[--color-fg-subtle]">{path}</p>
        )}
      </header>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="max-w-[480px] text-[13.5px] leading-relaxed text-[--color-fg-muted]">
      {children}
    </p>
  );
}

function stripTopHeading(md: string): string {
  return md.replace(/^# [^\n]*\n+/, "");
}
