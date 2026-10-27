# CLAUDE.md

@AGENTS.md

@STACK.md

The above are this project's real instructions, written to be useful to any
agent (Claude Code, Codex, or otherwise): AGENTS.md is the portable half and
STACK.md the half that names tools — AGENTS.md's opening says why they're
split. Edit those, not this. Two things are Claude Code-specific and live
only here:

- `.claude/settings.json` pre-approves the read-only and check/build commands
  used constantly in this repo (extend it as the project's own commands grow),
  denies reading the lockfile, and wires a `SessionStart` hook
  (`.claude/hooks/session-start.sh`) that installs dependencies before your
  first turn on a Claude Code web session.
- `.claude/logs/gates.jsonl` is a local, gitignored log `pnpm run gates`
  appends to — see AGENTS.md § Self-improving: closing the loop.
