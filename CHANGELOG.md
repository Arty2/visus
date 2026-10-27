# Changelog

What osseus gained, newest first, in a few words each. One section per minor
version, headed by the last version it shipped as: a patch rewrites its minor's
heading to the new number and adds its lines there, never a section of its own.
Features only — not fixes, not why, not how; that is the README's. Three lines
to a release, six at the very most. Plain text and `code` spans only.

## 0.3.0 — 2026-10-12

- Instructions in two layers: `AGENTS.md` for any project, `STACK.md` for this stack.
- `docs/LEARNINGS.md`: what the sibling apps learned, folded back in.
- A README shape and a pull request template that name no tools.

## 0.2.0 — 2026-10-03

- A changelog written for the people using the app, checked by `pnpm gates`.
- What's new: the version number opens the latest release, and opens by itself once after an update.

## 0.1.3 — 2026-09-23

- A SvelteKit and Vercel starter: strict types, a strict CSP and security headers, a 100 KB script budget.
- A working local-first list to copy: saved in the browser, JSON and Markdown export and import, undo.
- Light and dark themes that follow the system.
- Fast checks on every draft push, the full browser suite before merging, no builds for prose-only changes.
- Gates for rules a linter can't see, and a feedback log for what the template got wrong.
