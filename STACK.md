# STACK.md

The stack half of the instructions, read in full every session alongside
[AGENTS.md](./AGENTS.md), which holds the portable half and says why they're
split. Everything here names a tool. A project moving to a different stack
rewrites this file and TECHNICAL.md, and leaves AGENTS.md alone.

## The stack

SvelteKit 2 with Svelte 5 runes, TypeScript strict, Vite, pnpm. three.js
and tested libraries around it (TECHNICAL.md § Dependencies lists each). Vitest for
pure logic, Playwright for the browser. GitHub Actions decides whether a
change may land; Vercel's free tier builds and deploys it through
`@sveltejs/adapter-vercel`, and nothing deploys from Actions.

## Commands

pnpm dev · pnpm check · pnpm lint · pnpm gates · pnpm quick · pnpm test:unit
· pnpm test:e2e · pnpm test · pnpm build · pnpm feedback

`pnpm gates` runs `scripts/gates.sh`, the rules a linter can't enforce — see
TECHNICAL.md § The gates. `pnpm quick` (gates + types + unit tests, no
browser) is the one to run while iterating; it answers in a few seconds, and
is what a draft pull request runs in CI (plus lint). `pnpm test` is the full
suite — Playwright included — which is what ready-for-review
runs. `pnpm feedback "..."` appends a stub to TEMPLATE_FEEDBACK.md.

## Where things live

- **Version** — `package.json`, the only copy. `vite.config.ts` injects it as
  `__VERSION__`, `e2e/smoke.e2e.ts` asserts the page shows it, and
  `src/lib/changelog.ts` + `src/lib/WhatsNew.svelte` parse and show
  `CHANGELOG.md` (bundled with `?raw`).
- **Local-first data** — `src/lib/store/notes.ts` is the plain module
  (`Annotation`, `Viewpoint`, `SCHEMA_VERSION`, `migrate()`), positions in
  model coordinates; `src/lib/store/notes.svelte.ts` the thin class, one
  localStorage key per model (`modelKey`): `$state` holds the open model's
  notes, every mutating method calls one `persist()`, guarded by `browser`
  because the page is prerendered. `storageBroken` reports a failed write;
  `undoable`/`undo()` is a `$state.snapshot`. `src/lib/io/json.ts` and
  `markdown.ts` are the adapters, `src/routes/+page.svelte` the call site that
  refuses an empty import, `src/lib/io/download.ts` hands the browser a file.
- **Viewer** — `src/lib/viewer/`: three.js, imported after first paint.
  `viewer.ts` is the scene, desktop orbit and every VR control; `rig.ts`,
  `views.ts`, `files.ts`, `keyboard.ts` are the pure parts with tests;
  `load.ts` the loaders. The viewer never holds data: it calls `ViewerHooks`
  and is fed back through `$effect`. See TECHNICAL.md § The viewer.
- **Security policy** — `vite.config.ts` (SvelteKit's `csp`, `mode: 'auto'`)
  and the response headers in `vercel.json`.
- **CI** — `.github/workflows/ci.yml`: `check` on every push, `full` only on
  `main` and on a pull request that is no longer a draft.
- **No JavaScript budget** — written off for visus; TECHNICAL.md § The gates.

## Bootstrapping, the stack half

Renamed and demo replaced in 0.1.0. Still to do: **set up the Vercel
project** per TECHNICAL.md § Deployment, and **install Svelte's own agent
tooling** — `npx sv add ai-tools`; see below for what to pick.

## Svelte's own agent tooling

`npx sv add ai-tools` installs the Svelte team's Claude Code plugin, skills,
sub-agent and MCP server — better at being current about Svelte than this
file can be, so prefer it over anything here about Svelte itself. **Take the
skills; the MCP server is opt-in** (its tool definitions cost context every
session). **It merges into `.claude/settings.json`**: read the diff, keep the
allowlist, the lockfile deny and the `SessionStart` hook. **Don't vendor
their skills** — a copy is stale the day after it's taken. Reasoning in
[docs/PATTERNS.md § Svelte's own agent tooling](./docs/PATTERNS.md).

## Style

Svelte-specific correctness is the official tooling's job; what's left is
this project's own taste, which no skill knows about.

- Svelte 5 runes (`$state`/`$derived`/`$effect`), no legacy stores.
- Config lives in `vite.config.ts` — there is no `svelte.config.js`;
  `sveltekit()` takes the kit config directly.
- Never `{@html}`, `innerHTML` or `eval`; the gates fail on all three.
- Every new module in `src/lib` gets a test before it's wired into a
  component; one that needs WebGL or the DOM is driven in e2e instead.
  `src/lib/**/*.test.ts` is Vitest against plain functions in the `node`
  environment; UI is Playwright against `pnpm build && pnpm preview`,
  never reusing a running server (`playwright.config.ts`).
- A prerendered page can't carry a `style:` directive — it ships as a
  `style="…"` attribute that `style-src 'self'` refuses. Use a class, or the
  CSSOM.
