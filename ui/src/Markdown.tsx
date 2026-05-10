import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={{
        h1: ({ children }) => (
          <h1 className="mb-4 mt-2 text-[20px] font-medium tracking-[-0.01em] first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mt-9 mb-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[--color-fg-subtle]">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mt-7 mb-1.5 text-[14px] font-medium tracking-[-0.01em]">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="my-2.5 text-[14px] leading-relaxed text-[--color-fg-muted] first:mt-0">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="my-2.5 space-y-1.5 pl-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="my-2.5 list-decimal space-y-1.5 pl-5 marker:font-mono marker:text-[--color-fg-subtle]">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="text-[14px] leading-relaxed text-[--color-fg-muted] before:mr-3 before:text-[--color-fg-subtle] before:content-['—']">
            {children}
          </li>
        ),
        strong: ({ children }) => (
          <strong className="font-medium text-[--color-fg]">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children, className }) => {
          const isBlock = /language-/.test(className ?? "");
          if (isBlock) {
            return (
              <code className="block overflow-x-auto rounded-md bg-[--color-subtle] p-3 font-mono text-[12.5px] text-[--color-fg-muted]">
                {children}
              </code>
            );
          }
          return (
            <code className="rounded bg-[--color-subtle] px-1.5 py-0.5 font-mono text-[12.5px] text-[--color-fg]">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <pre className="my-3">{children}</pre>,
        a: ({ children, href }) => (
          <a
            href={href}
            className="text-[--color-fg] underline decoration-[--color-fg-subtle] underline-offset-[3px] hover:decoration-[--color-fg]"
            target="_blank"
            rel="noreferrer"
          >
            {children}
          </a>
        ),
        hr: () => (
          <div className="my-8 text-center font-mono text-[10px] tracking-[0.4em] text-[--color-fg-subtle]">
            · · ·
          </div>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-3 pl-4 italic text-[--color-fg-subtle]">
            {children}
          </blockquote>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
