# Template feedback

A log of friction this project hit that the `osseus` skeleton could have
prevented — kept here, in the project that hit it, rather than nowhere,
because a lesson that isn't written down gets rediscovered by the next
person (or the next session) instead of fixed once. See
[AGENTS.md § Self-improving: closing the loop](./AGENTS.md#self-improving-closing-the-loop)
for what happens to these entries.

This file is local-first the same way the rest of the app's data is: no
server collects it, nothing is aggregated automatically, and it only ever
says what actually happened in this repository. Committing it means it
travels with the code and shows up in `git log` and code review like any
other change — which is also the point: a reviewer sees _why_ a gate got
loosened or a dependency got added, not just that it did.

## When to add an entry

- A gate in `scripts/gates.sh` fired on something that was actually fine,
  and you turned it off or narrowed it.
- A CSP directive, security header, or the JS budget had to be loosened or
  raised for a real feature, not worked around.
- You wrote something from scratch that the skeleton should have shipped —
  a local-first pattern, an import/export format, a common component.
- You added a dependency to solve a problem this skeleton's "no dependency
  by default" stance made harder than it should have been.
- A gate, a lint rule, or a piece of `AGENTS.md` was simply wrong, confusing,
  or out of date the moment you tried to follow it.

Skip the ordinary stuff — a normal feature, a normal bug fix. This file is
for friction that's specifically about the _skeleton_, not about the app
being built on top of it.

## Format

One entry per finding, newest first, appended below the line. Keep each one
short — a paragraph, not a report:

```
## YYYY-MM-DD — one-line summary

What happened, and what you did about it in this repo. Link the commit or
PR if there is one. One sentence on what osseus itself should probably do
differently, if anything.
```

`pnpm run feedback "one-line summary"` appends a dated stub in this shape
so there's nothing to remember about the format — just fill it in.

**Folded entries are deleted.** Once an entry has been read back into
`osseus` — as a rule, a gate, or a lesson in its `docs/LEARNINGS.md` — it
comes out of this file, so the log only ever holds what hasn't been dealt
with yet. `osseus` keeps its own log the same way: the entries it wrote
about itself are in `docs/LEARNINGS.md` now, and a project templated from it
starts with nothing below the line.

---

<!-- Newest entries go directly below this line. -->

## 2026-10-27 — A WebGL app outgrows the 100 KB budget on day one

visus is a WebXR model viewer; three.js and two loaders are ~190 KB gzipped
before any app code, so `scripts/budget.sh` went to 240 KB in the first
commit, with the reasoning in the script. osseus could say up front that the
number is for a page of forms, and suggest measuring the first-paint chunk
separately from what's imported later. Later the same day the owner wrote
the budget off entirely for this project (see TECHNICAL.md § The gates): a
per-project opt-out may be worth saying out loud in osseus.

## 2026-10-27 — Trusted Types blocks `DOMParser`, even for XML

`require-trusted-types-for 'script'` makes `DOMParser.parseFromString` a
sink, so three.js's ColladaLoader fails under the skeleton's CSP. Worked
around without a policy (XHR `responseType: 'document'` from a blob: URL,
see TECHNICAL.md § The viewer). Worth a line in osseus's CSP notes: any XML
or SVG parsing library will hit this.

## 2026-10-27 — Headless Chromium draws no WebGL without flags

Every canvas test saw nothing until Playwright launched Chromium with
`--use-angle=swiftshader --enable-unsafe-swiftshader`. osseus's
`playwright.config.ts` could carry them, commented, for the first project
that draws.

## 2026-10-27 — "Workers are already allowed" isn't true under Trusted Types

`worker-src blob:` is in osseus's policy so a bundler-inlined Worker needs
no policy fight — but `require-trusted-types-for 'script'` makes
`new Worker(url)` demand a TrustedScriptURL, so any library that builds a
Worker from a string (three.js's Draco and KTX2 decoders here) is refused
anyway. visus added a `default` policy passing only same-origin `blob:`
script URLs, plus a gate keeping `createPolicy` to one file. osseus's CSP
notes promise workers work; they should say what it actually takes.
