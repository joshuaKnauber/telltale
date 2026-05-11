import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { POTENTIAL_FILE } from "./memory.ts";
import { dispatchPromote, PROMOTE_LOG } from "./promote-dispatch.ts";

interface Context {
  raw: string;
}

interface Entry {
  title: string;
  statement: string;
  count: number;
  contexts: Context[];
  status: string;
}

const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";

function parsePotential(text: string): Entry[] {
  const entries: Entry[] = [];
  const blocks = text.split(/^### /m).slice(1);
  for (const block of blocks) {
    const lines = block.split("\n");
    const title = (lines[0] ?? "").trim();
    let statement = "";
    let count = 0;
    let status = "potential";
    const contexts: Context[] = [];
    let inContexts = false;
    for (const raw of lines.slice(1)) {
      const line = raw.replace(/\s+$/, "");
      if (!line.trim()) continue;
      if (/^- Statement:/i.test(line)) {
        statement = line.replace(/^- Statement:\s*/i, "").trim();
        inContexts = false;
      } else if (/^- Count:/i.test(line)) {
        count = parseInt(line.replace(/^- Count:\s*/i, "").trim(), 10) || 0;
        inContexts = false;
      } else if (/^- Status:/i.test(line)) {
        status = line.replace(/^- Status:\s*/i, "").trim().toLowerCase();
        inContexts = false;
      } else if (/^- Contexts:/i.test(line)) {
        inContexts = true;
      } else if (inContexts && /^\s+- /.test(line)) {
        contexts.push({ raw: line.replace(/^\s+- /, "").trim() });
      }
    }
    if (title) entries.push({ title, statement, count, contexts, status });
  }
  return entries;
}

function summarizeContext(c: Context, max = 80): string {
  return c.raw.length <= max ? c.raw : c.raw.slice(0, max - 1) + "…";
}

function printEntryHeader(entry: Entry, idx: number, total: number) {
  console.log("");
  console.log(`${DIM}[${idx + 1}/${total}]${RESET} ${BOLD}${entry.title}${RESET}`);
  console.log(`        ${entry.statement}`);
  const evidence = `seen ${entry.count}× · ${entry.contexts.length} context${entry.contexts.length === 1 ? "" : "s"}`;
  console.log(`        ${DIM}${evidence}${RESET}`);
  if (entry.contexts.length > 0) {
    console.log(`        ${DIM}└ ${summarizeContext(entry.contexts[0]!)}${RESET}`);
  }
}

function printAllContexts(entry: Entry) {
  console.log("");
  console.log(`        ${DIM}All ${entry.contexts.length} context${entry.contexts.length === 1 ? "" : "s"}:${RESET}`);
  for (const c of entry.contexts) {
    console.log(`        ${DIM}·${RESET} ${c.raw}`);
  }
}

type Decision = "accept" | "reject" | "skip";

async function promptDecision(
  rl: ReturnType<typeof createInterface>,
  withInvestigate: boolean
): Promise<Decision | "investigate"> {
  const opts = withInvestigate
    ? `${GREEN}[a]ccept${RESET}  ${RED}[r]eject${RESET}  ${YELLOW}[i]nvestigate${RESET}  ${DIM}[s]kip${RESET}`
    : `${GREEN}[a]ccept${RESET}  ${RED}[r]eject${RESET}  ${DIM}[s]kip${RESET}`;
  while (true) {
    const ans = (await rl.question(`        ${opts} ${CYAN}›${RESET} `)).trim().toLowerCase();
    if (ans === "" || ans === "s" || ans === "skip") return "skip";
    if (ans === "a" || ans === "accept" || ans === "y" || ans === "yes") return "accept";
    if (ans === "r" || ans === "reject" || ans === "n" || ans === "no") return "reject";
    if (withInvestigate && (ans === "i" || ans === "investigate")) return "investigate";
    console.log(`        ${DIM}choose a / r${withInvestigate ? " / i" : ""} / s${RESET}`);
  }
}

function buildInstructions(promotes: string[], rejects: string[]): string {
  const parts: string[] = [];
  if (promotes.length > 0) {
    parts.push(`Promote: ${promotes.map((t) => `"${t}"`).join(", ")}.`);
  }
  if (rejects.length > 0) {
    parts.push(`Reject: ${rejects.map((t) => `"${t}"`).join(", ")}.`);
  }
  return parts.join(" ");
}

export async function runReview(): Promise<void> {
  if (!existsSync(POTENTIAL_FILE)) {
    console.log(`\nReview: nothing to review (${POTENTIAL_FILE} not found).`);
    return;
  }
  const text = readFileSync(POTENTIAL_FILE, "utf8");
  const entries = parsePotential(text).filter((e) => e.status === "potential");

  if (entries.length === 0) {
    console.log("\nReview: no pending findings.");
    return;
  }

  if (!process.stdin.isTTY) {
    console.log(
      `\n${entries.length} pending finding${entries.length === 1 ? "" : "s"} in potential-learnings.md.`
    );
    console.log(`Run \`telltale review\` interactively to handle them.`);
    return;
  }

  console.log("");
  console.log(`${BOLD}Found ${entries.length} candidate${entries.length === 1 ? "" : "s"} to review.${RESET}`);
  console.log(
    `${DIM}For each, choose: accept (promote to learnings.md), reject (skip permanently), investigate (see all contexts), or skip (decide later).${RESET}`
  );

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const promotes: string[] = [];
  const rejects: string[] = [];

  try {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      printEntryHeader(entry, i, entries.length);
      let decision = await promptDecision(rl, true);
      while (decision === "investigate") {
        printAllContexts(entry);
        decision = await promptDecision(rl, false);
      }
      if (decision === "accept") promotes.push(entry.title);
      else if (decision === "reject") rejects.push(entry.title);
    }
  } finally {
    rl.close();
  }

  console.log("");
  if (promotes.length === 0 && rejects.length === 0) {
    console.log(`${DIM}No changes — all skipped.${RESET}`);
    return;
  }

  if (promotes.length > 0) {
    console.log(`${GREEN}Promote (${promotes.length}):${RESET} ${promotes.join(", ")}`);
  }
  if (rejects.length > 0) {
    console.log(`${RED}Reject (${rejects.length}):${RESET} ${rejects.join(", ")}`);
  }

  const instructions = buildInstructions(promotes, rejects);
  const pid = dispatchPromote(instructions);
  console.log(`\n${DIM}Dispatched promote worker (pid ${pid ?? "?"}); tail ${PROMOTE_LOG} for status.${RESET}`);
}
