# AGENTS.md

Notes for whoever — human or agent, Claude or otherwise — picks this up
next. Two files are read in full every session: this one, which holds what
is true whatever the project is built with, and [STACK.md](./STACK.md),
which holds what is true because of what it is built with — commands,
frameworks, file paths. Read both before touching anything. They are kept
short on purpose, and the gates hold them to one line budget between
them: a bloated instructions file trains whoever reads it to skim. Push
detail into [TECHNICAL.md](./TECHNICAL.md),
[docs/LEARNINGS.md](./docs/LEARNINGS.md) or
[docs/PATTERNS.md](./docs/PATTERNS.md) instead. `CLAUDE.md` imports both —
edit these, not that.

## What this is

**This repo is `visus`**, a WebXR model viewer for the Meta Quest (see the
README), templated from `osseus` and already bootstrapped. What follows is
the skeleton's own description, kept because its rules still apply here.

`osseus` is a starter skeleton, not an app. Its job is to make the _next_
small web app fast to start — tooling, CI shape, security posture, docs and
a pull request template already decided — so a session's first turn on a
freshly templated repo goes straight to building. If you were just dropped
into a repo templated from this one, read **§ Bootstrapping** below before
anything else.

It comes in two layers, and keeping them apart is what lets the first be
reused for a project built with anything:

- **Portable** — this file, the shape of `README.md`, the pull request
  template, `CHANGELOG.md` and its rules, `TEMPLATE_FEEDBACK.md`, and the
  first half of `docs/LEARNINGS.md`. None of them names a language,
  framework, package manager or host.
- **Stack** — `STACK.md`, `TECHNICAL.md`, the code, the tests, `scripts/`,
  the CI workflow and the deploy config. Today that is SvelteKit on Vercel;
  a different stack replaces this layer and keeps the other.

A new rule goes in the layer it belongs to. If it would still hold in a
project with different tools, it goes here; if it names a tool, STACK.md.

## Bootstrapping

The first session in a repo templated from `osseus` should, in order:

1. **Ask what the app is**, if it isn't already obvious — don't guess a
   domain and start writing for it.
2. **Rename it** everywhere STACK.md § Bootstrapping lists, and `LICENSE`'s
   copyright line if the author differs.
3. **Rewrite `README.md` for the person using the app**, in the shape in
   [docs/LEARNINGS.md § The README](./docs/LEARNINGS.md#the-readme). Keep
   § Contributing; it is portable.
4. **Replace the demo, keep the pattern** — see § Local-first data, and
   STACK.md for where it lives. Update its end-to-end test to match rather
   than deleting the coverage.
5. **Reset the version** to `0.1.0`, and `CHANGELOG.md` to its preamble
   (renamed) plus one `## 0.1.0 — <today>` section saying what the app
   does. `TEMPLATE_FEEDBACK.md`'s log starts empty; keep it that way until
   the project has something of its own to say.
6. **Leave the gates, the security policy, the headers and the budget
   alone** unless the app genuinely needs something they forbid — see
   TECHNICAL.md for what each protects. Loosening one is a deliberate
   decision made in the commit that needs it, with the trade-off written
   down and logged (§ Self-improving), not a thing to clear out while
   tidying up.
7. **Finish with STACK.md § Bootstrapping** — deployment, the framework's
   own agent tooling, the session hook.

## Versioning

One file is the source of truth for the version (STACK.md says which), and
nothing writes the number a second time: the build injects it, a test
asserts the page shows it, and `CHANGELOG.md` heads with it, in a user's
words. A patch rewrites its minor's heading to the new number, never adds a
section. Patch for a fix, minor for a feature, and the leading zero never
moves except by a deliberate decision to call the project finished.

**Bump once per session, not once per change**, sized by the largest change
in it — one feature among five fixes is still a minor. Set it when the work
starts landing and leave it. **Once the session has a pull request open,
every further push bumps the patch** (`0.8.0` → `0.8.1` → …): a reviewer may
already have read the last one. A push that changes only docs or tooling —
nothing the user runs — doesn't bump.

`CHANGELOG.md` is for the person using the product; git is the history.
Features only — not fixes, not why, not how. A line is a group of related
changes, a few words long; three lines to a release, six at most. Plain text
and `code` spans: the app shows the latest release when the version is
clicked, and once by itself after an update — so **easter eggs and hidden
gestures stay out**. The gates check the top heading matches the version
and each release fits. Wording and examples: TECHNICAL.md § Versioning and
the changelog.

## Local-first data

The starter page is a small, real local-first app, not a placeholder — copy
its shape for real data rather than starting from nothing. Change the shape
of the data, not the shape of the pattern:

- **One plain module owns validity**: the data's type, a schema version, and
  a `migrate()` that turns anything — old data, garbage, nothing — into
  something valid. No storage, no DOM; a test calls it directly.
- **A thin layer owns persistence and reactivity** and does nothing else.
  Two things in it are not decoration and should survive into a real data
  model: **a write that fails is reported, not swallowed** (a private window
  or a full quota throws, and an app that looks like it saved is worse than
  one that says it couldn't), and **anything that can lose data offers one
  step back**, taken as a snapshot rather than written as an inverse.
- **Format adapters convert and nothing more.** They report what a file
  contains, including "nothing", and never decide what that means. **The
  policy lives at the call site** — the page refuses an empty import once,
  for every format, which is what stops importing a README from silently
  emptying the list. A parser that quietly substitutes defaults, or throws
  over a legitimately empty file, is the same mistake from opposite ends.

Default to Markdown (readable, diffable, with the `- [ ]` / `- [x]`
convention `listula` and `libelli` share) alongside JSON for what Markdown
can't hold; don't invent a third format before both stop being enough.

## Before you change anything

- **Evergreen browsers only.** No polyfills, no legacy target. A new CSS or
  JS feature has to be [Baseline: Widely available](https://web.dev/baseline),
  not merely Newly — and weigh the failure mode, not just the support table:
  one invalid at computed-value time can leave the page unreadable. This
  repo has broken the rule once already (`light-dark()`, black on black); see
  docs/LEARNINGS.md § Browsers.
- **The script the browser downloads has a hard budget** where the project
  keeps one (STACK.md says whether, and the number). Raise it deliberately,
  in the commit that earns it.
- **The security policy is strict about origins and injection, loose about
  local mechanics.** No third-party script origin, ever, and no route from a
  string to markup or script (the gates fail the build on them). Blob
  downloads, `data:` images, workers and WebAssembly are already allowed — a
  local-first feature shouldn't need a policy fight to ship. See TECHNICAL.md
  § Content Security Policy before tightening or loosening it.
- **Local-first and file-based over a backend.** Browser storage plus JSON /
  Markdown export before an API route and a database.
- **No runtime dependencies by default**, and no component library, CSS
  framework or crypto library. A dependency is a decision, with the
  trade-off written down and logged, not a habit. One held back on purpose
  says why, and what would end it.
- **Tests cover the pure logic; the interface is verified by driving it** in
  a real browser against a production build — never the dev server, and
  never a server left running from before.

## How we work

- **Small commits with real messages.** What changed, why that shape, and
  what was verified. No model names in anything that lands in the repo.
- **Verify in a real browser, not just in tests**, and read what the build
  emitted, not the config you wrote — a silently dropped option looks
  exactly like one that works. Say plainly what was checked and what wasn't.
- **Pull requests open as drafts.** A draft runs only the quick checks —
  rules, types, lint, unit tests — so every push answers in under a minute.
  Marking it ready for review runs the full suite, end-to-end tests
  included, and that is what has to pass before anything merges. A pull
  request that never leaves draft has never run its end-to-end tests.
- **Watch a pull request only when asked.** Never start following CI, or
  keep a check-in running, on your own initiative.
- **The README is the product as a user meets it.** A change to what a user
  can do or see isn't finished until the README says so, in the same
  commit.
- **A number in prose is read off the code**, at the time of writing — or
  better, the prose names the constant instead of the number.
- **Comments explain the why.** Not what the line does — why it's that way,
  and what breaks otherwise. Delete a comment that only restates the code.
- **Say the trade-off out loud** — in the commit, a comment, or
  `TEMPLATE_FEEDBACK.md` — rather than leaving it to be rediscovered.
- **Scratch work stays out of the repository.** Scripts and screenshots made
  to check something go in a scratch directory; read `git status` before any
  `git add -A`, and commit nothing you didn't write on purpose.
- **Cheap sessions are a design goal.** A session hook installs dependencies
  before the first turn, and an allowlist pre-approves the commands used
  constantly — extend both as the project's own commands grow. Lockfiles
  are never read into context.
- **Never ship anything traceable to reference material.** Sample data,
  placeholder names and demo content are invented; contact addresses use
  reserved `.example` domains.
- **Spelling**: British or American, either — but one, consistently, once
  the first real content is written.

## Self-improving: closing the loop

An agent (or a habit) that leaves no trace can't be debugged, audited, or
improved on. Two local mechanisms let this template get better from being
used, not only from being edited:

- **`TEMPLATE_FEEDBACK.md`** — a committed, append-only log of friction this
  _specific project_ hit that the skeleton could have prevented: a gate that
  fired on something legitimate, a policy that had to widen, a pattern
  reinvented by hand. The feedback command (STACK.md § Commands) appends a
  dated stub; the file's header says when an entry is (and isn't) warranted.
- **`.claude/logs/gates.jsonl`** — every run of the gates appends one line:
  timestamp, commit, and which checks passed or failed. Gitignored, never
  leaves the machine, but answers "which gate has never once fired" (retire
  it?) and "which keeps firing" (promote it?).

Neither reports anywhere. Closing the loop is a manual step, by a human or
an agent asked to: read a project's `TEMPLATE_FEEDBACK.md`, fold what proved
true into `osseus` — as a rule here or in STACK.md, a gate, or an entry in
[docs/LEARNINGS.md](./docs/LEARNINGS.md) — and then **delete the folded
entries from the project's log**, so it only ever holds what hasn't been
dealt with.

## If this project ever adds an AI feature

Nothing here talks to a model. If a feature ever feeds untrusted text (a
pasted document, a fetched page, another user's input) to a model with
tools, design for **privilege separation before the first prompt** — see
[docs/PATTERNS.md § Security posture for future AI features](./docs/PATTERNS.md).

## Where these choices came from

This skeleton started as a distillation of three sibling projects
(`listula`, `libelli`, `kalendes`) but isn't a straight copy of them —
[docs/PATTERNS.md](./docs/PATTERNS.md) records what was challenged against
outside practice, and [docs/LEARNINGS.md](./docs/LEARNINGS.md) what the
projects taught it since.

## Credits

Dialectic Acheiropoieton of Heracles Papatheodorou and&nbsp;Claude
