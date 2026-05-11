# Telltale

A quiet memory loop for Claude Code. Watches your sessions, extracts durable preferences, lets you confirm them, then makes Claude remember them in every future session.

After a session ends, an analyzer reads the transcript and stages observations in `~/.telltale/potential-learnings.md`. Once a candidate has been seen enough times — across projects or repeatedly within one — Claude raises it with you in your next session. Approved entries move to `~/.telltale/learnings.md`, which is `@import`-ed into your global `~/.claude/CLAUDE.md` and loaded into every Claude Code session.

Analysis runs through `claude -p` on your machine using your own auth. Nothing else is sent anywhere.

## Quick Start

```bash
npm i -g @jknauber/telltale
telltale setup
```

`telltale setup` will:

- create `~/.telltale/` (memory dir + git repo)
- add an `@import` line to your global `~/.claude/CLAUDE.md`
- register `SessionEnd` and `PreCompact` hooks in `~/.claude/settings.json` so future sessions feed telltale automatically
- analyze your most recent Claude Code session transcripts
- walk you through any candidates it found, interactively

## CLI

- `telltale setup [--no-scan] [--limit <n>]` — initialize the memory dir, git repo, and `@import` line; optionally analyze the `<n>` most-recent transcripts (default 5).
- `telltale review` — walk pending candidates interactively: accept, reject, investigate, or skip each. Accepted/rejected items are applied in a single detached worker.
- `telltale promote "<instructions>"` — apply a free-text promote/reject instruction. Usually called by in-session Claude (when it surfaces a pending learning), not by hand.

Internal subcommands (`telltale __hook`, `__analyze`, `__promote`) are entry points for the Claude Code hook and child processes; you don't invoke them directly.

## Contribution

```bash
git clone https://github.com/joshuaKnauber/telltale.git
cd telltale
npm install
npm run dev:link        # builds + links `telltale` globally to this clone
```

After `dev:link`, the global `telltale` command points at your local `dist/cli.js`. Rebuild with `npm run build` to pick up changes. Run `npm run dev:unlink` to remove the link.

Other scripts:

- `npm run dev -- setup` — invoke the CLI via tsx without building (useful for quick iteration)
- `npm run build` — bundle to `dist/cli.js`
- `npm run typecheck`

Releases use [Changesets](https://github.com/changesets/changesets):

- `npx changeset` — describe what changed
- `npm run version` — bump version + update changelog
- `npm run release` — build and publish

## License

MIT
