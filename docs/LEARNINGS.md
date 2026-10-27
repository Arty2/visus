# Learnings

What projects built on (or alongside) `osseus` found out the hard way, folded
back in so the next one doesn't have to. Each entry is a rule, then the
evidence for it — the rule is what to follow, the evidence is what to weigh
when the rule seems not to fit.

Entries arrive from a project's `TEMPLATE_FEEDBACK.md`, or from reading a
sibling project's README and instructions file. Once one is here, it is
deleted from the file it came from: the feedback log holds what has not been
folded yet, and nothing else. See [AGENTS.md § Self-improving](../AGENTS.md#self-improving-closing-the-loop).

The file is in the same two layers as the instructions. **Portable** lessons
would hold in a project built with anything; **stack** lessons name a tool,
and go with the stack if it is replaced.

Sources, by name: `osseus` (this repository reviewing itself), `kalendes` (an
iCal timeline), `libelli` (spreadsheet rows to printed cards), `listula` (a
shared, encrypted checklist).

---

## Portable

### CI and review

**A draft pull request runs only the quick checks; marking it ready for
review runs the full suite, end-to-end tests included.** Two questions at
two prices: "is this coherent" (rules, types, lint, unit tests — seconds, on
every push) and "may this land" (all that plus a real browser, the bundle
budget, a dependency audit — minutes, only when landing is in prospect). The
default branch always runs both. A pull request that never leaves draft has
never had its end-to-end tests run, which is why the full run, not the
quick one, is what gates the merge.
_Evidence: `listula` and `osseus` run this split; `libelli` runs everything
on every push and `kalendes` has no browser suite in CI at all — the two
ends the split sits between._

**Skipping prose is a rule for everything that runs on a push, not just CI.**
A docs-only change that skips CI still triggered a hosted preview build on
every push, and most of a template's history is prose. Wherever a "skip
this" rule is written, ask what else listens to the same push. Fail open: if
the skip check can't tell, build.
_Evidence: `osseus` and `kalendes`, 2026-09-23._

**A skipped workflow reports no status, and a required status that never
reports blocks the merge forever.** Decide this before turning on branch
protection, not on a stuck README fix.
_Evidence: `kalendes`'s CI comment; `osseus` TECHNICAL.md § CI._

**A file the build bundles is not prose**, even if it ends in `.md`. Re-include
it in every skip rule, or a change to it deploys nothing and runs no gate.
_Evidence: `osseus`, when CHANGELOG.md started shipping inside the app._

**A newer push cancels the run still going for the older one.** It says
everything the older one did.
_Evidence: all four._

### Rules that execute

**A rule nothing executes gets broken by the next person with a good reason —
including the person who wrote it.** Where a rule can be asserted (a gate, a
test), assert it; where it can't, it is a paragraph, and paragraphs drift.
_Evidence: `osseus` broke its own Baseline rule with `light-dark()` in the
same repository that stated it twice; `libelli` keeps the line "every rule
above that can be checked is"._

**A check that cannot run must fail, not pass.** The instructions-file budget
first reported "ok" when it could not read the file at all.
_Evidence: `osseus`, 2026-09-11._

**Make every threshold overridable from the environment**, so the failure
path can be exercised without editing the check.
_Evidence: `osseus` gates (`AGENTS_MAX=10`, `CHANGELOG_MAX=1`)._

**Log every run of the rules locally.** A check that has never fired in months
is a candidate to retire; one that keeps firing wants promoting into the
product or into documentation people actually read. Local, gitignored, never
uploaded.
_Evidence: `osseus` and `libelli` both keep `.claude/logs/gates.jsonl`._

**"Keep it short" is a budget, not a request.** Every budget — bundle bytes,
instructions-file lines, changelog lines — needs a number and something that
reads it. Raise it deliberately, in the commit that earns it.
_Evidence: `osseus`'s AGENTS.md grew 25% in one session that was arguing
against bloat; `libelli` gates its own instructions file the same way._

**A number quoted in prose is read off the code at the time of writing, never
from memory or from other prose** — and better, the prose names the constant
rather than the number.
_Evidence: `listula`'s instructions said 100 characters per task for as long
as the code said 200._

### Read the output, not the input

**A config option that is silently ignored looks exactly like one that
works.** After a change to anything the toolchain rewrites — security
policy, service worker precache list, prerendered HTML, minified CSS — open
the built file and check the change is in it.
_Evidence: `osseus` documented a framing protection in three places that the
build had dropped; `kalendes` hand-wrote a prefixed/unprefixed pair the
minifier collapsed to the prefixed form alone, which two of three engines
ignore; `libelli` states the rule outright._

**Test against a production build, not the dev server.** Module-format
interop can differ between the test runner, the dev server and the
production bundler; only the last is what users get.
_Evidence: in `kalendes`, 524 unit tests passed and `dev` worked while the
production build parsed no feed at all. One browser run against the
production preview caught it._

**Never reuse a server that was already running for end-to-end tests.** It
serves whatever build was on disk, and every failure then points at the
wrong thing.
_Evidence: `listula`, carried into `osseus`._

### Browsers

**Baseline _Widely_ available, not merely _Newly_ — and weigh the failure
mode, not just the support table.** A feature that degrades costs little; one
that is invalid at computed-value time takes the whole declaration with it
and can leave a page unreadable. Exceptions are allowed when taken knowingly
and written down with their fallback.
_Evidence: `osseus`'s black-on-black dark theme (`light-dark()`, which turns
Widely available on 2026-11-13 — worth revisiting then); `libelli` keeps three
named exceptions, each with what happens without it._

### Data

**A parser reports; the caller decides.** A format adapter says what a file
contains, including "nothing". Whether "nothing" is acceptable is policy, and
it lives at the one place the destructive decision is made. Two adapters each
inventing their own emptiness rule is how one silently emptied a list while
the other refused to re-import a file it had just written.
_Evidence: `osseus` and `libelli`, independently._

**Anything that can lose data owes one step back**, taken as a snapshot
rather than written as an inverse operation — an inverse drifts out of step
with the operation it undoes.
_Evidence: `osseus`, `libelli`, `kalendes`._

**A write that fails is reported, not swallowed.** An app that looks like it
saved is worse than one that says it couldn't.
_Evidence: `osseus`._

**Big things are referenced, not embedded**, so what is shared stays small
enough to paste into a message.
_Evidence: `libelli` templates name fonts and images rather than carry them._

### The README

**The README is the product as a user meets it.** Developer detail —
commands beyond the first three, architecture, conventions — belongs in the
instructions file and the technical notes. The four READMEs converged on one
shape, in this order, each section optional except the first and last:

1. **Title, and one paragraph** saying what it is and who it's for, in plain
   words a non-developer can follow.
2. **Links**: project page, live instance, source.
3. **Name** — where the word comes from, in a sentence or two.
4. **What it does / Use** — the sections a user needs, written in brief,
   plain, encyclopaedic prose. Tables first where there is a reference to
   look things up in (gestures, keys, syntax), a sentence or two after.
5. **What leaves this machine** — every network request the app makes, and
   what asked for it. The honest version of "privacy-friendly".
6. **Limitations** — what it can't do, stated plainly, before a user finds
   out the hard way.
7. **Deployment**, if anyone else might host it — with any check written to
   be safe to paste as-is.
8. **Development** — three commands at most, the versioning table, and
   pointers to the instructions file and the changelog.
9. **Credit and licence.**

_Evidence: `kalendes`, `libelli`, `listula` READMEs._

**Where the README is the only record of how the app behaves, a change to
that behaviour is not finished until the README says so, in the same
commit.** One record, never repeated elsewhere, or there are two to keep in
step and one is always wrong. The section can say so of itself: "if this and
the app disagree, the app is right and this is out of date".
_Evidence: `listula`, where nothing on screen is labelled and the README's
Gestures section is the only way to find most of the app._

**Say what leaves the machine and why**, by name: each kind of request, and
what a user did to cause it.
_Evidence: `libelli` § What leaves this machine._

### Versioning and the changelog

**The changelog is for the person using the product; git is the history.**
Features only, in their words, a few lines a release. A fix that gives the
user something new to rely on is written as that behaviour.
_Evidence: all three siblings and `osseus`._

**Easter eggs and hidden gestures stay out of the changelog** if the app
shows it to every user — it would announce them.
_Evidence: `kalendes`._

**Changes that touch only docs or tooling don't bump the version**, since
nothing the user runs changed.
_Evidence: `kalendes`._

**A patch on every push is a development tool, not only a courtesy to
reviewers** — when the app shows its version, the number is how to tell a
stale preview, an installed app or a cached build from the latest push.
Worth adopting outright for an installable or offline-capable app.
_Evidence: `kalendes`, a PWA, bumps the patch on every app-changing push,
pull request or not._

### Working

**Scripts and screenshots made to check something go in a scratch directory
outside the repository**, and `git status` is read before any `git add -A`.
Commit nothing you didn't write on purpose.
_Evidence: `libelli`._

**Watch a pull request only when asked.** Never start following CI, or keep a
check-in running, on your own initiative.
_Evidence: `libelli`._

**A risky change that isn't this session's job is handed off as a written
brief** — order, hot spots, the exact verification — not started on the
side.
_Evidence: `kalendes`'s four-major toolchain upgrade._

**A dependency held back on purpose says why, and what would end it.**
"Stays on 5.9 until the type checker supports 7 without a flag" is a
decision; an unexplained old version is an invitation to upgrade it.
_Evidence: `kalendes`._

**Before writing guidance about a dependency, check whether it ships its
own.** Frameworks increasingly maintain agent skills and docs; a template's
copy of them is stale the day after it's taken.
_Evidence: `osseus`, 2026-09-11, on Svelte's `ai-tools`._

**Never read a lockfile into context.** It is hundreds of kilobytes and never
the answer; change it only through the package manager, and deny it in the
agent's settings.
_Evidence: `kalendes`, `libelli` and `osseus` deny it; `kalendes` denies its
minified build output for the same reason._

---

## Stack: SvelteKit, Vite, Vercel

**`frame-ancestors` is ignored in a `<meta>` CSP**, and SvelteKit drops it when
writing the tag. On prerendered pages the framing protection has to be a
response header (`vercel.json`), checked by a gate.
_Evidence: `osseus`, 2026-09-11._

**A prerendered page cannot carry a `style:` directive or `style="…"`**
under `style-src 'self'`: Svelte writes it as a literal attribute in the
shipped HTML. Write custom properties through the CSSOM instead.
_Evidence: `listula`._

**Vercel's Git integration doesn't read Actions' `paths-ignore`.** An
`ignoreCommand` in `vercel.json` carries the same rule; exit 0 skips, and a
git error (exit 128) builds.
_Evidence: `osseus` and `kalendes`._

**A dependency can ship its own copy of another, and a byte budget can't
tell.** `pnpm why <pkg>` (or `npm ls`) on each runtime dependency when it's
added; check a worker bundle too, since it carries its own copy.
_Evidence: `kalendes` shipped two iCal parsers, twice; forcing one cut both
chunks by ~39% gzipped._

**Vitest defaults to the `node` environment; a file that needs a DOM opts in
on its first line.** A global DOM environment was over half of `kalendes`'s
suite time.
_Evidence: `kalendes` (jsdom → per-file, then happy-dom)._

**Write only the unprefixed `backdrop-filter`.** The CSS minifier adds the
prefix itself, and a hand-written pair collapsed to the prefixed form alone.
_Evidence: `kalendes`._

**Never write custom properties on `:root` in a path that then measures
layout.** It invalidates style for the whole document; the next measurement
forces a full pass. Read first, write after, write only on change.
_Evidence: `kalendes`, ~400 ms of startup._
