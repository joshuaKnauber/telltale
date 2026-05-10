import { useEffect, useState } from "react";
import { api } from "../api.ts";
import { Markdown } from "../Markdown.tsx";
import { isMarkdownEmpty } from "../md.ts";
import { PageShell, Empty } from "./Learnings.tsx";

export function Potential() {
  const [data, setData] = useState<{ content: string; path: string } | null>(null);

  useEffect(() => {
    void api.potential().then(setData).catch(() => {});
  }, []);

  return (
    <PageShell
      title="Potential"
      blurb="Staged observations under verification. Promoted to learnings once enough independent evidence accrues."
      path={data?.path}
    >
      {data && isMarkdownEmpty(data.content) ? (
        <Empty>
          Once the analyzer spots a candidate observation, it lands here with the context it was
          seen in.
        </Empty>
      ) : data ? (
        <Markdown>{stripTopHeading(data.content)}</Markdown>
      ) : null}
    </PageShell>
  );
}

function stripTopHeading(md: string): string {
  return md.replace(/^# [^\n]*\n+/, "");
}
