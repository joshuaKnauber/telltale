import { homedir } from "node:os";
import { join } from "node:path";

export const MEMORY_ROOT = join(homedir(), ".telltale");
export const TELLTALE_BIN = "telltale";
export const LEARNINGS_FILE = join(MEMORY_ROOT, "learnings.md");
export const POTENTIAL_FILE = join(MEMORY_ROOT, "potential-learnings.md");
export const GLOBAL_CLAUDE_MD = join(homedir(), ".claude", "CLAUDE.md");
export const IMPORT_LINE = `@${LEARNINGS_FILE}`;
export const IMPORT_MARKER = "<!-- telltale: auto-managed import (do not remove) -->";

export const INITIAL_LEARNINGS = `# Learnings

<!-- analyzer writes entries here; replace this comment when adding content. user may edit freely. -->
`;

export const INITIAL_POTENTIAL = `# Potential Learnings

<!-- analyzer writes entries here; replace this comment when adding content. user may edit freely. -->
`;
