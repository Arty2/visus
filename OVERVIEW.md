# What's actually in here

The other documents in this repo (`AGENTS.md`, `STACK.md`, `TECHNICAL.md`,
`docs/`) are written tightly, for whoever — human or AI agent —
is about to edit the code and needs the rules without the padding. This one
is written the other way round: for a person who just wants to understand
what they got, in plain language, before diving in.

## In one sentence

A small, fast, secure website starter you can clone, rename, and start
building on today, deployed for free on Vercel, with the boring-but-easy-
to-get-wrong decisions (security headers, testing, CI, how data is stored)
already made and already working.

## What you actually get

- **A real working page**, not a blank one. Open it up and there's a small
  to-do-style list you can add to, tick off, export, and re-import. It's
  not the app you're going to build — it's there so "how do I store data
  locally and let someone get it back out" is something you can see
  working and copy, instead of something you have to invent on day one.
- **Nothing leaves the browser by default.** The list above lives in
  `localStorage`. There's no database, no sign-up, no server tracking what
  you do. If your app needs a backend later, that's a deliberate addition,
  not something bolted on because the starting point assumed you'd need one.
- **Two ways to get your data out**: a JSON file (for another program, or a
  backup) and a Markdown file (for a human, or a text editor, or GitHub).
  Both come back in the same way they went out.
- **Nothing destructive happens without a way back.** Deleting an item or
  importing a file that replaces the list both offer one step of undo. And
  an import that would empty the list is refused rather than applied —
  picking the wrong file in a file picker shouldn't cost you your data.
- **It tells you when it can't save.** If the browser refuses to write to
  storage (a private window, blocked site data, a full quota), the page says
  so instead of looking like it saved and losing everything on reload.
- **A security posture that's actually thought through**, not just
  maximally paranoid. Third-party scripts can't run on your site, period.
  But things that are genuinely harmless — showing a generated image,
  spinning up a background worker, running WebAssembly — aren't blocked
  just because blocking everything is easier than deciding.
- **Tests that mean something.** The data logic (what counts as a valid
  item, how import/export formats work) is unit-tested. The actual page —
  the buttons, the list, the accessibility of it — is tested by literally
  driving a browser and clicking things, the same way a person would.
- **A CI pipeline that respects your time.** Push a work-in-progress pull
  request and you get an answer in under a minute (did it typecheck, does
  it lint, do the tests pass). Only when you mark it ready to merge does it
  spend the extra minute running the browser tests too.
- **A three-line pull request template** — what changed, why, what you
  checked. Nothing to fill out that you'll skip anyway.
- **Two layers, kept apart.** How the work is done (instructions, the
  README's shape, the pull request template, versioning) is written so it
  would hold for any project; what it's built with (SvelteKit, Vercel) lives
  in separate files. Changing the stack means replacing the second, not
  untangling the first.
- **It's ready for an AI coding assistant on day one**, not as an
  afterthought. There's an instructions file it reads automatically, a
  startup script that installs everything before the assistant's first
  reply, and a pre-approved list of safe commands so it isn't asking
  permission to run `pnpm test` for the tenth time.

## How the pieces fit together

```
  your browser                          your repo (this one)
 ┌──────────────┐                      ┌───────────────────────┐
 │  the page     │──writes/reads──────▶│  localStorage           │
 │  (Svelte)     │                      │  (stays on your device)│
 └──────┬───────┘                      └───────────────────────┘
        │ export ▼           ▲ import
   ┌────────────┐      ┌────────────┐
   │ items.json │      │ items.md   │   ← files you can email, back up,
   └────────────┘      └────────────┘     or open in any text editor

  when you're ready to ship it:

  git push  ──▶  GitHub Actions (fast checks on every push,
                  the full suite once you mark it ready)
                 ──▶  Vercel (builds and deploys automatically,
                       free tier, previews on every pull request)
```

## The design patterns inside

Worth naming explicitly, because they're the shapes worth copying into your
own code, not just implementation detail:

- **Separation of "what's valid" from "how it's stored."**
  `src/lib/store/items.ts` is plain functions — no browser APIs, no
  reactivity — deciding what a valid item is and how to fix broken data.
  `src/lib/store/items.svelte.ts` is a thin wrapper that only does two
  things: hold the data reactively, and save it. This is the classic
  "keep your business logic separate from your framework" pattern, sized
  down to fit a single file pair. It's what makes the logic testable
  without ever touching a real browser.
- **Versioned migration, not "hope the data doesn't change."**
  `SCHEMA_VERSION` plus a `migrate()` function means the day the shape of
  your data changes, there's already a place to teach the app how to read
  the old shape — instead of every user's saved data silently breaking.
- **Adapters for every format you speak.** `src/lib/io/json.ts` and
  `markdown.ts` both convert to and from the same internal `Item` shape.
  Neither knows the other exists, and neither knows about `localStorage`.
  Adding a third format (CSV, say) means adding a third file, not touching
  either of these two.
- **Strict at the boundary, lenient about drift.** Reading your own
  `localStorage` is forgiving — corrupted or old data just falls back to
  sensible defaults, because crashing over your own leftover data helps no
  one. Reading a file someone hands you on purpose is strict — a bad import
  tells you exactly what was wrong with it, because silently ignoring a
  file someone chose to import is worse than complaining about it.
- **The parser reports; the caller decides.** Neither format adapter has an
  opinion about whether an empty file is acceptable — they just say what's
  in it. The page decides, once, for both formats. This isn't pedantry: the
  first version had each adapter making its own call, and they ended up
  disagreeing in opposite directions (one silently wiped your list, the
  other refused to re-import a file it had just written).
- **Undo as a snapshot, not a reversal.** Anything that can lose data takes
  a copy first (`$state.snapshot`, so it doesn't share objects with the live
  list) and offers one step back. Writing an "inverse" of each operation
  instead is how undo quietly drifts out of step with the thing it undoes.
- **A facade over a genuinely awkward browser API.**
  `src/lib/io/download.ts` hides the actual sequence needed to hand someone
  a file (make a `Blob`, make a temporary URL for it, make an invisible
  link, click it, clean up afterwards) behind one function call:
  `downloadText(name, type, content)`.
  Every export button calls the same one function — there's exactly one
  place that logic could go wrong, not one per button.
- **Gates as an extensible checklist, not a wall of prose.**
  `scripts/gates.sh` is a short list of automated checks for the rules that
  would otherwise just live in a document and slowly stop being true. Each
  one is small, named, and testable — adding a new rule to the project
  means adding a new check, not adding a new paragraph to a file nobody
  re-reads before making the change it warns against.
- **Headroom instead of a wall.** The security policy allow-lists a couple
  of things (background workers, WebAssembly) that nothing in this starter
  actually uses yet. That's deliberate: the day you need one of them, it
  already works, rather than starting with a security policy fight before
  you can even try the feature.
- **A feedback loop that writes itself down.** Every time the automated
  checks run, a short local record gets appended (never uploaded anywhere)
  of what passed and what didn't. And there's a running, committed log —
  `TEMPLATE_FEEDBACK.md` — for writing down the moments this starter got in
  your way, specifically so the next version of it can get out of your way
  faster. See the next section.

## Self-improving: how this template is meant to get better

This is a starting point, not a finished product, and it's built on the
idea that the best evidence for how to improve it is what actually happens
when real projects use it — not more guessing up front.

Two lightweight, completely local mechanisms exist for that:

1. Whenever this project has to fight the template — a security rule that
   blocked something reasonable, a pattern you had to build from scratch
   that the skeleton should have already had — that gets written down in
   `TEMPLATE_FEEDBACK.md`, right in this repo. One command
   (`pnpm feedback "what happened"`) starts the entry for you.
2. Every time the automated project checks run, a small structured record
   is kept on your own machine (never shared or uploaded) of what passed
   and what didn't, over time. It's there so a pattern — "this check has
   never once failed in months" or "this check keeps firing" — is
   something you can actually look at, instead of something you'd have to
   remember.

Neither of these phones home. Nothing here is collected, aggregated, or
sent anywhere automatically — that would need its own privacy policy and
its own justification, for a benefit that's really only useful to the
person holding the keyboard. Instead, closing the loop is a human (or an
AI agent, asked to) reading back a project's `TEMPLATE_FEEDBACK.md` every
so often, deciding what's actually worth changing in the template itself,
writing the lesson into the template's `docs/LEARNINGS.md`, and clearing it
out of the project's log.

**It has already run, more than once.** Reviewing this starter against its
own written rules — rather than against anyone else's best practice — turned
up two real faults, both now fixed and both recorded in `docs/LEARNINGS.md`: a CSS
feature used in defiance of the repo's own browser-support rule (with an
unreadable-page failure mode on browsers that don't have it yet), and an
import that could silently empty your list with no way back. Both had been
documented as things not to do, in the same repository, and both happened
anyway. The lesson went back into the template as tests and a refusal at the
one place it mattered — which is the whole argument for this mechanism over
writing more rules. Later, the three sibling apps it was drawn from were
read back the same way — their READMEs and instructions — and what they had
learned went in alongside.

## What's deliberately left out

- **No backend, no database, no accounts.** If your app needs those, it's a
  real decision to add them, and you'll know exactly why you did.
- **No component library, no CSS framework.** The starting styles are
  plain CSS, on purpose — a library is a real dependency with real
  trade-offs, not a default.
- **No offline / installable-app support (PWA) out of the box.** Not every
  small app needs an install prompt and a service worker; adding one later
  is a small, well-understood step, not an architecture change.
- **No AI features.** Nothing here talks to a language model. If you add
  one later — especially one that reads content you don't fully control —
  there's guidance in `docs/PATTERNS.md` on doing that safely, written in
  advance so it's there when you need it rather than something to research
  under pressure.

## Where to go next

- **Building the app?** Start with `README.md`, then open
  `src/routes/+page.svelte` and start replacing the demo.
- **Working with an AI coding assistant?** It should already be reading
  `AGENTS.md` and `STACK.md` (or `CLAUDE.md`, which just points to both)
  automatically.
- **Starting something that isn't SvelteKit?** The portable half —
  `AGENTS.md`, the README's shape, the pull request template, the changelog
  rules, `docs/LEARNINGS.md` — carries over as it is; write your own
  `STACK.md`.
- **Curious why something is the way it is?** `TECHNICAL.md` has the CI
  internals, the deployment steps, and the reasoning behind the security
  choices. `docs/PATTERNS.md` has the wider comparison this template's
  choices were checked against, and what changed as a result.
- **Ready to deploy?** `TECHNICAL.md § Deployment` is a five-step Vercel
  checklist, free tier included.
