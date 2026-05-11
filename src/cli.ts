import { existsSync } from "node:fs";
import { defineCommand, runMain } from "citty";
import { MEMORY_ROOT } from "./memory.ts";
import { runSetup } from "./setup.ts";
import { runReview } from "./review-cli.ts";
import { dispatchPromote, PROMOTE_LOG } from "./promote-dispatch.ts";

const setupCmd = defineCommand({
  meta: {
    name: "setup",
    description:
      "Create memory dir + git repo, wire @import into global CLAUDE.md, then run an initial analyze sweep over recent session transcripts.",
  },
  args: {
    scan: {
      type: "boolean",
      description: "Run an initial analyze sweep over recent transcripts after install.",
      default: true,
      negativeDescription: "Skip the initial sweep.",
    },
    limit: {
      type: "string",
      description: "Number of most-recent transcripts to analyze in the initial sweep.",
      default: "5",
    },
  },
  async run({ args }) {
    const limit = Number(args.limit);
    if (!Number.isFinite(limit) || limit < 0) {
      console.error(`error: --limit must be a non-negative number (got ${args.limit})`);
      process.exit(2);
    }
    await runSetup({ skipScan: !args.scan, limit });
  },
});

const reviewCmd = defineCommand({
  meta: {
    name: "review",
    description:
      "Walk through pending candidates in potential-learnings.md, accept/reject/investigate each, then dispatch a single combined promote worker in the background.",
  },
  async run() {
    await runReview();
  },
});

const promoteCmd = defineCommand({
  meta: {
    name: "promote",
    description:
      'Apply the user\'s promote / reject decision to telltale memory files. Pass quoted free-text instructions: telltale promote "promote rule about X, reject rule about Y"',
  },
  args: {
    instructions: {
      type: "positional",
      description: "Free-text describing what to promote and/or reject. Quote it.",
      required: true,
    },
  },
  run({ args }) {
    const instructions = args.instructions.trim();
    if (!instructions) {
      console.error("error: empty instructions");
      process.exit(2);
    }
    if (!existsSync(MEMORY_ROOT)) {
      console.error(`error: memory root missing at ${MEMORY_ROOT}; run \`telltale setup\` first`);
      process.exit(1);
    }
    const pid = dispatchPromote(instructions);
    console.log(
      `telltale: promote queued (pid ${pid ?? "?"}; tail ${PROMOTE_LOG} for status).`
    );
  },
});

const main = defineCommand({
  meta: {
    name: "telltale",
    version: "0.0.1",
    description: "Local memory loop for Claude Code: stages and promotes durable preferences.",
  },
  subCommands: {
    setup: setupCmd,
    review: reviewCmd,
    promote: promoteCmd,
  },
});

runMain(main);
