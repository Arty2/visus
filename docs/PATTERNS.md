# Outside patterns: what changed and why

This skeleton started as a distillation of three sibling projects —
`listula`, `libelli`, `kalendes` — built by the same author. That's a
reasonable starting point, but "we've always done it this way across three
repos" is still just one author's taste, not evidence that the taste is
right. This document is the record of checking that taste against practice
from outside all four repos, specifically Simon Willison's public writing on
agentic engineering and the local-first design of his own tools (Datasette,
`sqlite-utils`, `llm`), and changing what didn't hold up.

## What was checked

- Simon Willison's **Agentic Engineering Patterns** guide and newsletter
  writing on coding agents — instruction-file design, planning before large
  changes, and the role of logging/observability in letting an agent (or a
  human) improve its own process.
- His **"How I use LLMs to help me write code"** — testing discipline, review
  habits, and treating an LLM as a fast, overconfident collaborator rather
  than an oracle.
- The **dual-LLM pattern** (2023) and its 2025 generalisation into six
  agent-security design patterns, "Design Patterns for Securing LLM Agents
  against Prompt Injections" (arXiv:2506.08837, fourteen authors across
  Google, Microsoft, IBM, ETH Zurich and EPFL, with Willison's original
  pattern as one of the six).
- The design philosophy behind **Datasette / `sqlite-utils` / `llm`**:
  transparent, composable, file-based tools that treat their own logs as
  artifacts worth storing and reviewing, over black-box workflows.
- **Svelte's own agent tooling** (`svelte.dev/docs/ai`, the `ai-tools`
  add-on in `sv` 0.17.0, `@sveltejs/mcp` 0.1.26) — the framework's official
  answer to the same question this skeleton is trying to answer, and
  therefore the sharpest available check on it. See § Svelte's own agent
  tooling below.

Willison's writing was reached by web search rather than by direct access to
`simonwillison.net`, which this environment blocks, so treat those specifics
as paraphrase of well-attested public reporting rather than quotation. The
Svelte findings are firmer: `svelte.dev` is blocked here too, so instead of
reading the docs page the `sv` package itself was downloaded from npm and its
`ai-tools` add-on read directly — the client list, tool names and file paths
below are from that source, not from a summary of it.

## What changed, and what didn't

Written out rather than tabulated: the table this replaced was 500 characters
a row and unreadable in a terminal or a diff, which is where it actually gets
read.

### Instructions file — changed

The sibling repos put everything in `CLAUDE.md`; `listula`'s is roughly 70 KB
of dense, deliberate prose. Outside practice points the other way on both
counts: bloated instruction files reportedly get skimmed or ignored wholesale
rather than selectively applied, and `AGENTS.md` has emerged as the portable
convention that other agents read and that `CLAUDE.md` can import in one line.

**Verdict:** `AGENTS.md` holds the real instructions and `CLAUDE.md` is an
`@AGENTS.md` import plus the two genuinely Claude Code-specific notes. Detail
that wants to exist lives in `TECHNICAL.md` or here, where nobody pays for it
on every turn.

This verdict originally claimed the file was "kept to roughly 150 lines",
which lasted exactly one session: it reached 275 without anyone noticing,
because the only thing enforcing brevity was the sentence at the top of the
file asking for it. `scripts/gates.sh` now budgets it the way
`scripts/budget.sh` budgets JavaScript — a number that has to be raised
deliberately, in the commit that earns it. Same lesson as everything in
§ The loop below, arrived at a third time.

**Later split in two (2026-10-12).** `AGENTS.md` kept everything that holds
whatever the project is built with — versioning, the changelog, the
local-first principles, how work is done and reviewed — and `STACK.md` took
everything that names a tool. `CLAUDE.md` imports both and the budget counts
both, since splitting a file is not a way to shorten it. The point is reuse:
the portable half, with the README's shape and the pull request template,
carries to a project on a different stack unchanged.

### CSP strictness — changed

`listula` allows almost nothing but `'self'`: no `blob:`, no `data:`, no
WebAssembly. That is correct _there_ — it holds a decryption key in browser
memory for the life of the tab, so any successful injection is a total
compromise. Inherited into a generic skeleton, the same policy forecloses
most of what local-first apps are actually made of: workers, WASM engines,
canvas exports, blob downloads.

**Verdict:** relaxed where strictness bought nothing — `img-src data: blob:`,
`worker-src blob:`, `connect-src blob:`, `script-src 'wasm-unsafe-eval'`.
Origins, `object-src` and `base-uri` stay locked: those
are the directives that actually stop an attack. See TECHNICAL.md
§ Content Security Policy.

### Dependency-lightness — reinforced

`libelli` hand-writes its own Markdown renderer, CSV parser and QR encoder
rather than taking dependencies. The `llm`/Datasette philosophy arrives at
the same place from a different direction: transparent, composable tools;
portable abstractions over lock-in.

**Verdict:** kept, with outside support rather than in spite of it. "No
runtime dependency by default" stands, and `src/lib/io` is the pattern in
miniature.

### Verification loop — kept and extended

The sibling repos already do the important part: gates in CI, pure logic unit
tested, UI verified by driving a real browser. What they don't have is any
record _across_ runs. The outside argument is that a process leaving no
inspectable trace can't be debugged, audited or improved — which is why `llm`
logs every prompt and response to SQLite and treats those logs as artifacts.

**Verdict:** gates and CI stay as they were, plus `scripts/gates.sh` now
appends one structured line per run to a local, gitignored log, so "which
gate has never once fired" is answerable instead of anecdotal.

### AI/agent security — new

None of the three sibling repos touches an LLM at runtime, so there was no
precedent either way. The field's standing answer for agents that hold both
tool access and untrusted text is privilege separation.

**Verdict:** documented as forward guidance (below, and a pointer in
AGENTS.md), deliberately not implemented — there's no AI feature here to
secure, and speculative security scaffolding is its own kind of liability.

### Local-first data — changed

Every sibling repo does local-first well, but each for its own domain, and
`osseus` inherited the _posture_ without the _pattern_: the starter page was
a placeholder counter. Willison's tools treat "a plain, portable, inspectable
local file" as the default shape of data rather than a feature to add.

**Verdict:** the starter page is now a real local-first list — versioned
storage with a migration path, JSON and Markdown export/import, one-step
undo on anything destructive, and a visible warning when the browser refuses
to save. The pattern is there to extend rather than to remember to add.

### Self-improvement — new

Each sibling repo is a finished app, so there was nothing to close a loop on.
A template is different: it's used repeatedly, and the evidence for changing
it is generated by those uses.

**Verdict:** `TEMPLATE_FEEDBACK.md` (committed, per project) plus the local
gates log. See AGENTS.md § Self-improving: closing the loop.

## Svelte's own agent tooling

Checked last and worth the most, because it isn't an analogy: Svelte ships
official tooling for exactly the problem this skeleton exists to solve, so
where the two disagree, the framework is a better authority on itself than a
template is.

`npx sv add ai-tools` (`sv` 0.17.0) offers, per client — Claude Code, Cursor,
Gemini, OpenCode, VS Code:

- a **Claude Code plugin** from a `sveltejs/ai-tools` marketplace entry, which
  the add-on marks "recommended, auto-installs & updates";
- two **skills**, `svelte-code-writer` and `svelte-core-bestpractices`;
- a **sub-agent**, `svelte-file-editor`;
- the **Svelte MCP server** (`@sveltejs/mcp` 0.1.26), local over stdio or a
  remote endpoint, which answers from the official documentation and runs
  static analysis over generated components to catch mistakes models
  reliably make in Svelte 5.

### What it validates

For the `claude-code` client, the add-on's own configuration sets
`agentPath: "AGENTS.md"` and writes an `agentLink` at `.claude/CLAUDE.md`
whose entire contents are `@../AGENTS.md`. That is, independently, exactly
the structure this skeleton moved to in the previous review — canonical
instructions in a portable `AGENTS.md`, with the Claude-specific file reduced
to a one-line import. Two parties reaching the same shape from different
directions is about as much confirmation as a convention of this kind gets.
(The one difference is location: they put the pointer in `.claude/CLAUDE.md`,
this repo keeps it at the root. Both work; the root file is more discoverable
to a human opening the repo, which is why it stays.)

### What changed here

The skeleton was hand-writing Svelte guidance — "Svelte 5 runes, no legacy
stores" — while the framework maintains skills, a sub-agent and an MCP that
do that job properly and stay current with the framework's own releases.
Writing a worse copy of that by hand, in a file loaded into every session,
is the same mistake as vendoring a dependency you could install.

**Verdict:** `sv add ai-tools` is now step 7 of the bootstrap checklist,
STACK.md has a section on what to pick, and its Style section explicitly
defers Svelte correctness to that tooling and keeps only this project's own
taste — which no skill knows about.

### What was declined, and why

- **Not vendored.** Their skills are not copied into this template. A copy of
  someone else's maintained file is stale the day after it's taken, and a
  template that ships stale framework advice is worse than one that ships
  none. Install at bootstrap, from the source that updates.
- **The MCP server is opt-in, not assumed.** Skills are lazy-loaded — a
  description line until something needs them — while an MCP server's tool
  definitions cost context on every session. That sits directly against this
  project's "cheap sessions are a design goal", so the recommendation is
  skills and the sub-agent by default, the MCP when the project is
  Svelte-heavy enough to earn it. This is the one place the skeleton
  deliberately takes less than the official tooling offers, and the reason is
  written down rather than implied.
- **Nothing about `sv create`.** The obvious question a reader will have —
  why not just tell people to run `npx sv create` — is answered by what this
  repo is: `sv create` produces an unopinionated starting point, and every
  decision in `TECHNICAL.md` is a thing it leaves to you. The two aren't
  competitors; this is `sv create` plus the dozen decisions afterwards.

## The loop, run twice on this repo

Worth recording because it's the only real evidence the mechanism does
anything. Reviewing this skeleton _against its own rules_ — not against
outside practice — has turned up three faults so far, all fixed, all logged
in `TEMPLATE_FEEDBACK.md` at the time and since folded into
`docs/LEARNINGS.md`:

1. **`src/app.css` broke the Baseline rule the same document states twice.**
   It used `light-dark()`, Baseline Newly available until 2026-11-13, whose
   failure mode on a non-supporting engine is an unreadable page rather than
   a degraded one. Now a `prefers-color-scheme` query, asserted in
   `e2e/theme.e2e.ts`.
2. **An import could silently empty the list.** `fromMarkdown` reads prose
   with no bullets as zero items — correctly — and the page applied that
   result, so importing a README replaced everything with nothing, said
   nothing, and offered no way back. Now refused at the call site, with undo
   behind every destructive action regardless.
3. **Three documents claimed a `frame-ancestors` protection the app never
   shipped.** `frame-ancestors` is ignored in a `<meta>` CSP by
   specification; SvelteKit knows that and drops it when writing the tag, so
   on prerendered pages — all of them — the app's own policy said nothing
   about framing. `X-Frame-Options` was quietly doing the whole job. Found by
   reading the generated
   `.svelte-kit/output/prerendered/pages/index.html` instead of the config
   that was supposed to produce it. Now a real one-directive
   `Content-Security-Policy` header in `vercel.json`, with the gate checking
   it stays there.

The pattern in all three: the rule was written down and still broken,
because nothing executed it. That is the argument for gates and asserted
tests over documentation, and it applies to this document too. The third
adds a second lesson worth keeping — **read what the build emitted, not the
config you wrote**. A config option that is silently dropped looks identical
to one that works, and the test that was supposed to cover it (`e2e/csp.e2e.ts`,
which fails on console errors) would have passed just as happily against a
page with no CSP at all.

## Borrowed back from kalendes

The first time this skeleton's practices were carried _into_ a sibling
(`kalendes`, 2026-09-23), three things came back the other way:

1. **Vercel doesn't read `paths-ignore`.** CI here already skipped
   prose-only commits, but every one of them still cost a Vercel preview
   build. Now `vercel.json` carries an `ignoreCommand` with the same rule —
   see TECHNICAL.md § CI.
2. **A dependency can bring its own copy of another, and the budget can't
   tell.** `ical-expander` pinned `ical.js@^1` while the app used 2, so both
   parsers shipped — twice, since a worker bundles its own. Forcing one
   copy (an npm `overrides` entry) cut both chunks by ~39% gzipped. A byte
   budget sees the total, not the duplicate; `pnpm why <pkg>` (or `npm ls`)
   on each runtime dependency is the check, and it's worth running once
   whenever one is added.
3. **Module-format interop differs between test, dev and production.**
   That override put a CommonJS `require()` in front of an ESM-only,
   default-only module. Vitest (Node resolves the package's CJS build) and
   `vite dev` (esbuild unwraps a default-only module) both worked; the
   Rollup production build handed over the namespace object and no feed
   parsed. 524 unit tests passed. A browser pointed at `vite preview` caught
   it in one run. That is the case for this repo's Playwright suite building
   and serving the production output rather than the dev server
   (`playwright.config.ts`), stated as evidence rather than as preference —
   and a reason not to "speed up" e2e by pointing it at `vite dev`.

One practice from the same session is worth copying too: a large, risky
change that isn't this session's job (there, a four-major toolchain upgrade)
was handed off as a written brief in `docs/` — order, hot spots, the exact
verification script — rather than started on the side. It costs no CI
(`docs/` is prose), and the next session starts from decisions instead of
from `npm outdated`.

## Changelog and versioning — adopted

A write-up of how another working repository keeps a user-facing changelog
and a version that never disagrees with itself was folded in on 2026-10-03.
Most of it already matched (`package.json` as the one source, patch for a
fix, minor for a feature, bump once per session, patch on every push to an
open PR); what was new was the changelog itself and the checks. Adapted
rather than copied:

- **No lockfile check.** The original checks `package-lock.json`'s copy of
  the version; `pnpm-lock.yaml` has none, so the gate reads `package.json`
  alone and TECHNICAL.md says what to add on switching to npm.
- **Every `## ` heading must parse**, not just the top one. The original
  checks the top heading's version; but the app's parser skips a heading it
  can't read, so a malformed one further down would be a release the dialog
  never shows with nothing failing.
- **The parser is tested against the real file**, so the shell regex and the
  TypeScript one can't drift apart without a unit test noticing.
- **"Show it in the product" went in**, since the skeleton already shows its
  version: the number opens the latest release. Bundling a `.md` file into
  the build broke an assumption — that prose can't change the build — that
  both `paths-ignore` in CI and `vercel.json`'s `ignoreCommand` were resting
  on. Both now re-include `CHANGELOG.md`; a changelog-only push would
  otherwise have deployed nothing and run no gate.
- **The wording examples are this skeleton's own**, not the source's.

## Security posture for future AI features

Nothing in `osseus` talks to a model — this section is dormant guidance for
the day a project built on it adds one (a "chat with your data" panel, an
LLM-assisted import, anything that hands an LLM both tool access and
untrusted text).

The risk in that shape of feature is **prompt injection**: text from outside
the developer's control (a pasted document, a fetched web page, another
user's input) reaching an LLM that also has the ability to take actions,
where the text itself can contain instructions that redirect those actions.
Willison's **dual-LLM pattern** (2023) is the original, still-cited answer:
split the work between a **privileged** component that plans and acts but
never reads untrusted content directly, and a **quarantined** component (no
tool access at all) that's allowed to read that content and can only return
data back to the privileged side — never instructions it will blindly obey.

The 2025 paper generalises this into six related patterns for constraining
what an agent can do with content it didn't choose to trust: privilege
separation (the dual-LLM shape above), plan-then-execute (decide the whole
action sequence before looking at untrusted data), a map-reduce variant (a
special case of the dual-LLM idea for processing many untrusted documents),
and others addressing where a human confirmation step has to sit. None of
the six is a library to install — they're shapes for how data and tool
access flow through a system, decided at design time.

If this becomes relevant: read the actual paper (arXiv:2506.08837) and
Willison's own commentary before designing the feature, choose the pattern
that fits the actual data/tool flow, and write the decision into this
project's own `docs/decisions.md` or equivalent — the same way every
load-bearing choice in the sibling repos gets written down, not just coded.
