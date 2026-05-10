export function isMarkdownEmpty(content: string): boolean {
  if (!content) return true;
  const stripped = content
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^# [^\n]*\n+/, "")
    .trim();
  return stripped.length === 0;
}
