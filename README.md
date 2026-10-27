# osseus

**osseus** is a starter template for small web apps, not an app itself. It
settles the dozen things every new project otherwise re-decides — how data
is stored and got back out, security headers, tests, CI, versioning, a pull
request template, instructions for a coding agent — so the first day goes on
the app. Its own starter page is a real, working local-first list: saved in
the browser, exportable and importable as JSON or Markdown, with one step of
undo behind anything that can lose data.

- **Source** — [github.com/arty2/osseus](https://github.com/arty2/osseus)
- **New here?** [OVERVIEW.md](./OVERVIEW.md) explains what's in the box in
  plain language, with a diagram; this README is the quickstart.

## Name

Greek ὀστέον, Latin _os_, _ossis_ — bone. The skeleton a new web app is
built on.

## Two layers

The template is in two layers, kept apart so the first can be reused on a
project built with anything:

- **Portable** — how the work is done: instructions for agents
  (`AGENTS.md`), this README's shape, the pull request template, versioning
  and `CHANGELOG.md`, `TEMPLATE_FEEDBACK.md`, and what was learned
  (`docs/LEARNINGS.md`). None of it names a tool.
- **Stack** — what it's built with: SvelteKit, Svelte 5, TypeScript, pnpm,
  Playwright, GitHub Actions, Vercel. `STACK.md`, `TECHNICAL.md`, `src/`,
  `e2e/`, `scripts/`, `.github/workflows/`, `vercel.json`.

A different stack replaces the second layer and keeps the first.

## Using it

On GitHub, **Use this template → Create a new repository**. Then open
`AGENTS.md` and work through
[§ Bootstrapping](./AGENTS.md#bootstrapping) — written for an agent session
picking this up cold, but a checklist either way. It renames the project,
rewrites this README for the people who'll use the app, resets the version,
and hands over to `STACK.md` for the deployment and the framework's own
agent tooling.

## Contributing

Open a pull request as a draft and leave it there while you work. A draft
runs only the quick checks — the project's rules, types, lint and unit tests
— so every push gets an answer in well under a minute. Mark it ready for
review once you want it merged: that runs the full suite, end-to-end tests
included, and it has to pass before anything lands on `main`.

The pull request template is three headings and nothing else — **What**,
**Why**, **Verified**. Fill in what changed, why it's shaped that way, and
what you actually checked; leave the rest for the diff to say.

## Versions

Numbered `0.minor.patch`, and the leading zero never changes:

| Change    | Bumps     | Example       |
| --------- | --------- | ------------- |
| A fix     | the patch | 0.2.0 → 0.2.1 |
| A feature | the minor | 0.2.1 → 0.3.0 |

[CHANGELOG.md](./CHANGELOG.md) is what each version gained.

## The stack

SvelteKit 2, Svelte 5 runes, TypeScript strict, deployed to Vercel's free
tier. Evergreen browsers only, a 100 KB budget on the JavaScript the browser
downloads, and a Content Security Policy that is strict about what matters
(third-party script origins, markup injection) and deliberately loose about
local-first mechanics that cost nothing to allow.

```
pnpm install
pnpm dev
```

| Command          | Does                                                    |
| ---------------- | ------------------------------------------------------- |
| `pnpm check`     | `svelte-check` against the strict tsconfig              |
| `pnpm lint`      | Prettier and ESLint                                     |
| `pnpm gates`     | Project rules a linter can't enforce — see TECHNICAL.md |
| `pnpm quick`     | Gates, types and unit tests — no browser, no build      |
| `pnpm test:unit` | Vitest, pure logic only                                 |
| `pnpm test:e2e`  | Playwright against a production build on port 4173      |
| `pnpm test`      | Everything CI runs, in CI's order — the pre-push check  |
| `pnpm build`     | Production build through `@sveltejs/adapter-vercel`     |
| `pnpm budget`    | Fails if the gzipped JS bundle exceeds 100 KB           |
| `pnpm feedback`  | Appends a dated stub to `TEMPLATE_FEEDBACK.md`          |

`pnpm quick` is the one to run while working. `pnpm test` is what to run
before asking for a change to land. Deployment is Vercel's Git integration —
see [TECHNICAL.md § Deployment](./TECHNICAL.md#deployment-vercel-hobbyfree-tier).

```
src/
  app.html    document shell — no inline scripts, no inline styles (see TECHNICAL.md § CSP)
  app.css     theme tokens per prefers-color-scheme, a minimal reset, prefers-reduced-motion
  app.d.ts    ambient types, including __VERSION__
  lib/
    store/    the local-first data model: plain types + migrate() in items.ts,
              a thin $state-backed class in items.svelte.ts
    io/       JSON and Markdown export/import, hand-rolled; download.ts hands
              the browser a file
    changelog.ts, WhatsNew.svelte
              CHANGELOG.md parsed, not rendered — the version number opens
              the latest release, and does once by itself after an update
  routes/     +layout.ts (prerendered), +layout.svelte, +page.svelte — a real,
              working local-first list, not a placeholder
e2e/          Playwright: the item list and its undo, a CSP/console-error
              tripwire (which also exercises export/import), the computed
              theme colours in both schemes, a browser that refuses to
              save, an axe-core a11y pass
scripts/
  gates.sh    rules a linter can't enforce, run first in CI; also logs to
              .claude/logs/gates.jsonl (local, gitignored — see AGENTS.md)
  budget.sh   the 100 KB gzipped JS ceiling
  feedback.sh appends a stub to TEMPLATE_FEEDBACK.md
.claude/      settings.json + a SessionStart hook, so a Claude Code web session
              lands with dependencies already installed
```

## The documents

`AGENTS.md` and `STACK.md` (both imported by `CLAUDE.md`) are the
instructions, portable and stack-specific; `TECHNICAL.md` covers CI
internals, the deployment runbook, and the reasoning behind the security
headers and CSP; `docs/LEARNINGS.md` is what projects built on this taught
it; `docs/PATTERNS.md` is what was checked against outside practice;
`TEMPLATE_FEEDBACK.md` is where a project logs friction with the skeleton,
until it's folded into `docs/LEARNINGS.md`.

## License

MIT — see [LICENSE](./LICENSE).

## Credit

Dialectic Acheiropoieton of Heracles Papatheodorou and Claude.
