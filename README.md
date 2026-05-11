# Telltale

Telltale is a quiet memory loop for Claude Code. After each session ends, it reads the transcript, picks up the small signals that reveal how you actually work (corrections, repeated requests, things you push back on), and stages them as candidate preferences. When the pattern firms up, Claude raises it with you in your next session. You say yes or no. Approved entries land in `~/.telltale/learnings.md`, which is imported into every future Claude Code session.

Or skip waiting on Claude: run `telltale review` any time to walk pending findings yourself and confirm them in one pass.

> [!NOTE]
> Runs locally. Analysis goes through your own `claude -p`. Nothing else leaves your machine.

## Quick Start

```bash
npm i -g @jknauber/telltale
telltale setup
```

`telltale setup` will:

- Create `~/.telltale/`, a small git-tracked memory dir for your learnings
- Add an `@import` line to your global `~/.claude/CLAUDE.md` so confirmed preferences load into every session
- Register `SessionEnd` and `PreCompact` hooks in `~/.claude/settings.json` so future sessions feed telltale on their own
- Analyze your most recent Claude Code transcripts
- Walk you through any candidates it surfaced

To walk pending findings any time after that:

```bash
telltale review
```

From there, you mostly forget about it. The hooks do the watching. Claude prompts you when a finding is ready to confirm. The rest stays out of the way.

## CLI

`telltale setup [--no-scan] [--limit <n>]`
Initialize the memory dir, git repo, CLAUDE.md import, and hooks. Optionally analyze the `<n>` most recent transcripts (default 5).

`telltale review`
Walk pending candidates interactively. For each one: accept, reject, investigate, or skip. Decisions are batched into a single background worker that updates your files and commits.

`telltale promote "<instructions>"`
Apply a free-text promote/reject instruction. Usually invoked by in-session Claude when it surfaces a pending learning. You rarely call this by hand.

Internal subcommands (`__hook`, `__analyze`, `__promote`) are entry points for the Claude Code hook and child processes. You don't invoke them yourself.

## Contribution

```bash
git clone https://github.com/joshuaKnauber/telltale.git
cd telltale
npm install
npm run dev:link
```

`dev:link` builds and symlinks the global `telltale` command to this clone. Edit, then `npm run build` to pick changes up. `npm run dev:unlink` removes the link when you're done.

Other scripts:

- `npm run dev -- setup` runs the CLI through tsx without building
- `npm run build` bundles to `dist/cli.js` with Rolldown
- `npm run typecheck` runs `tsc --noEmit`

Releases use [Changesets](https://github.com/changesets/changesets):

- `npx changeset` to describe what changed
- `npm run version` to bump and update the changelog
- `npm run release` to build and publish

## License

MIT
