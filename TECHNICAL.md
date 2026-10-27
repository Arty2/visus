# Technical notes

The detail that didn't belong in the README: the CI pipeline, the gates it
runs, the deployment runbook, and the reasoning behind a few defaults that
are easy to second-guess out of context. This file is the stack layer's long
form, like [STACK.md](./STACK.md): a project that changes stack rewrites
both. See [README.md](./README.md) for the quickstart and
[AGENTS.md](./AGENTS.md) for how to work in this repo.

## CI

CI is two jobs, and which of them runs is decided by whether the pull
request is a draft.

|                              | Runs                                                                       | Takes |
| ---------------------------- | -------------------------------------------------------------------------- | ----- |
| Draft pull request           | `check` — gates, types, lint, unit tests                                   | ~30s  |
| Ready for review, and `main` | `check` **and** `full` — the above plus Playwright and `pnpm audit --prod` | ~90s  |

Open a pull request as a draft and leave it there while you work. Every push
gets the short answer, which catches the ordinary mistake — a type error, a
lint failure, a broken gate, a unit test — in well under a minute. Mark it
ready for review when you want it merged: that's what runs Playwright, and a
pull request that never leaves draft has never had its end-to-end tests run.
`main` always runs both.

The full suite can also be asked for by hand from the Actions tab
(`workflow_dispatch`) without marking anything ready.

Two more things decide whether CI runs at all: a commit touching only `.md`
files is skipped, since prose can't break a build — except `CHANGELOG.md`,
which the app bundles and the gates check — and a newer push cancels
the run still going for the older one, because it says everything the older
one did.

Vercel builds a preview for every push on its own, independently of Actions,
so the same rule lives in `vercel.json` too: `ignoreCommand` diffs against
the branch's last deployment (`VERCEL_GIT_PREVIOUS_SHA`, falling back to
`HEAD^`) and skips the build when only `.md` files changed, `CHANGELOG.md`
aside (a second `git diff` on it alone, joined with `&&`, because a git
pathspec can't re-include a file its own exclude matched). Exit 0 means
skip; if git can't resolve the base — a shallow clone, a first deploy — the
diff exits 128, which Vercel treats as "build", so the failure mode is an
ordinary build rather than a missing one.

**One trap worth knowing about before you turn on branch protection.**
`paths-ignore` means a docs-only pull request produces _no_ check runs at
all — and a required status check that never reports blocks the merge
indefinitely, showing "Expected — waiting for status". Three ways out, in
order of preference: mark the required check as not required and rely on
`main` always running both jobs; touch any non-`.md` file in that PR; or
drop `paths-ignore` and accept paying for CI on prose. This skeleton keeps
`paths-ignore` because a template's own history is mostly prose, but if you
enable required checks on a project built from it, decide this deliberately
rather than discovering it on a stuck README fix.

## The gates

`scripts/gates.sh` fails the build on things a linter can't see: any route
from a string to markup (`{@html}`, `innerHTML`, `eval`, …), a `PUBLIC_`
environment variable whose name reads as a secret, the baseline security
headers going missing from `vercel.json` (including the `Content-Security-Policy`
one that carries `frame-ancestors` — see § Security headers), `AGENTS.md` and
`STACK.md` together growing past a line budget, and `CHANGELOG.md` not heading with the version
in `package.json` or a release in it running long — see § Versioning and the
changelog. This is the place to add the next rule that only
prose currently enforces — a gate that fails loudly the first time it's broken
is worth more than a paragraph nobody re-reads. Keep each one scoped to what
it actually checks, and comment the _why_, not the _what_.

Two conventions worth copying when adding one. Make the threshold
overridable (`AGENTS_MAX=10 pnpm run gates` exercises the failure path
without editing the file), and make a check that _can't run_ fail rather
than pass — the line-budget gate originally reported "ok" when it couldn't
read the file at all, which is the one outcome worse than not having it.

**There is no JavaScript budget.** osseus ships one (`scripts/budget.sh`,
100 KB gzipped), visus raised it to 240 KB for three.js, and then wrote it
off: for a headset model viewer, what matters is what it can open and how
well it runs once loaded, and a byte ceiling was steering choices away from
tested libraries toward hand-rolled code. Download size is still worth
watching — three.js and anything added are imported after first paint, so
the page itself stays quick — but nothing fails over it.

Every `pnpm run gates` invocation also appends one line to the local,
gitignored `.claude/logs/gates.jsonl` — see § Self-improving below.

## Versioning and the changelog

The rules are in [AGENTS.md § Versioning](./AGENTS.md#versioning); this is
the shape, the wording, and what checks them.

**The file.** `CHANGELOG.md` is a preamble for people reading it, then one
section per minor version, newest first, headed `## X.Y.Z — YYYY-MM-DD` (em
dash, en dash or hyphen). The heading names the last version the minor
shipped as: `0.4.1` becoming `0.4.2` rewrites `## 0.4.1 — …` to
`## 0.4.2 — <today>` and adds its lines there, if it brought anything a user
would notice. `0.5.0` starts a new section above. So the top heading is
always the version being shipped, which is what makes the rule checkable.

**The wording.** Each line says what someone can now do or rely on, in their
words — not which component, handler or setting does it:

| Too technical                                                            | For the user                                  |
| ------------------------------------------------------------------------ | --------------------------------------------- |
| Add `ItemsStore.undo()` backed by `$state.snapshot`                      | Deleting or importing can be undone.          |
| Refactor `fromMarkdown` to accept `* [x]`, nested lists, CRLF            | Markdown import reads more kinds of list.     |
| Fix empty import replacing the list (#12)                                | An import with nothing in it is refused.      |
| `prefers-color-scheme` tokens, `color-scheme` meta, theme e2e assertions | Light and dark themes that follow the system. |

The third row is a fix that stays: the user can now rely on something new,
so it's written as behaviour. Fixes that change nothing a user can rely on
are left out entirely; git has them. One line is a group of related changes
— a feature and the options that came with it — so three lines is the usual
release and six the limit. Blank lines and wrapping don't count.

**Plain text and `code` spans only**, because the app reads the file rather
than rendering it as Markdown: `src/lib/changelog.ts` parses headings with
the same pattern the gate uses and splits bullets into text and code runs,
and `src/lib/WhatsNew.svelte` shows the latest release behind the version
number. It's bundled with Vite's `?raw` import — offline, no request, and
always the build's own — and it opens once by itself after an update (the
last version seen is kept in `localStorage`); a first visit only records it,
because the page is its own introduction. No Markdown library, and no
`{@html}`, so the gates' injection-sink check has nothing to say about it.

**What checks it.** `pnpm gates` fails when the top heading isn't
`package.json`'s version (and says whether to rewrite the heading or add
one), when any `## ` heading isn't in the readable shape — the parser would
skip it silently — when a release passes `CHANGELOG_MAX` (6) non-blank lines,
and on bold, links or headings inside a release. Each is testable without
editing anything: `CHANGELOG_MAX=1 pnpm run gates`, or `CHANGELOG=<file>` to
point it at a broken copy. `src/lib/changelog.test.ts` reads the real file
through the real parser, so the app and the gate can't disagree about it.

There is no lockfile check: `pnpm-lock.yaml` doesn't record the root
package's version, so `package.json` really is the only copy. A project that
switches to npm gets one — `package-lock.json` has it twice, at the root and
under `packages[""]` — and should add it to the gate, regenerating with
`npm install --package-lock-only` rather than by hand.

## Theming: dark, and only dark

visus has one theme. `src/app.css` sets `color-scheme: dark` and a set of
tokens on `:root` — surfaces, lines, text, IBM's orange 40 for anything
that can be acted on, purple 40 for notes — with no `prefers-color-scheme`
branch. Type is IBM Plex Sans and Plex Mono, self-hosted. A headset
browser is used in a dim room, and one theme designed properly beats two
done by halves. The model itself is seen against white unless chosen
otherwise (`src/lib/viewer/backdrop.ts`).
With one set of values there's nothing to choose before first paint, so no
theme script and no flash.

The canvases drawn inside the headset (`src/lib/viewer/panel.ts`) can't read
CSS custom properties, so `src/lib/viewer/theme.ts` repeats the same values
— as strings for the 2D canvas, as numbers for three.js materials. Change
one file, change the other.

The tokens are plain hex and rgba. osseus first wrote its theme with
`light-dark()`, which wasn't Baseline Widely available, and on an engine
without it the custom properties never resolved and the page went black on
black. `e2e/theme.e2e.ts` asserts the computed colours under both system
schemes, so a token that stops resolving fails a test rather than shipping.
If a light theme is ever wanted back, it is user-chosen (the system already
said dark is fine), which means a small pre-paint script from `static/` —
the pattern `listula` and `kalendes` use — not a media query.

## Baseline browser support

Evergreen browsers only: no polyfills, no legacy transpilation target, no
`core-js`. Before reaching for a new CSS or JS feature, check it's
[Baseline: Widely available](https://web.dev/baseline) — the “widely
available” tier (safe roughly 2.5 years after the last engine shipped it),
not merely “newly available” (shipped everywhere, but recently). `svelte.config`
does not set a `browserslist`; there is nothing here for one to target once
transpilation is off the table.

This is a real constraint, not a suggestion: a feature that is Baseline
Newly Available today reads fine on the two browsers that just shipped it
and breaks silently on the fraction of traffic still one version behind.
When in doubt, ship the older, safer primitive.

## Content Security Policy

`vite.config.ts` configures SvelteKit's built-in CSP (`csp: { mode: 'auto',
directives: {...} }`) rather than a hand-written meta tag, because a
hand-written policy and SvelteKit's own hydration script don't coexist —
`'auto'` hashes inline scripts on prerendered pages and uses nonces on
dynamic ones. Two things are pinned rather than generic:

- `require-trusted-types-for: script` plus `trusted-types:
svelte-trusted-html sveltekit-trusted-url` — both policy names are created
  by the framework itself (Svelte's own template writes, and the service
  worker registration if one is ever added), and Chrome refuses to hydrate
  without the first allow-listed.
- One pinned hash under `'unsafe-hashes'` in `style-src`, for SvelteKit's own
  `#svelte-announcer` element, which carries a hardcoded `style="..."`
  attribute this project doesn't author and can't switch off.
  `e2e/csp.e2e.ts` fails on any console error, which is what catches a
  SvelteKit upgrade changing that string before it ships quietly.

`src/app.html` deliberately does not use the SvelteKit scaffold's `<div
style="display: contents">` wrapper — that's a literal `style="..."`
attribute in markup this project owns, not something the framework injects
and hashes for itself, and `style-src 'self'` refuses it. If a future change
needs that wrapper, wrap the CSS in a class instead of reaching for `style:`.

**Strict where it costs nothing to be, loose where strictness would just be
security theatre for a generic skeleton.** `default-src`, `script-src`'s
origins, `object-src` and `base-uri` stay locked down —
no third-party origin ever gets a free pass, because that's the directive
that actually stops a supply-chain or XSS payload from phoning home. Four
things are allow-listed that a maximally strict policy would refuse — none
of them load anything from off-origin, and all four are ordinary local-first
plumbing:

- `img-src: data: blob:` — a picture can't execute script. This is the one
  directive where "strict by default" was pure caution rather than a real
  defence, so it's open, and Vite's default small-asset inlining (which
  turns small imported assets into `data:` URIs) is left on rather than
  disabled.
- `worker-src: blob:` — a bundler-inlined Web Worker (the way `kalendes`'s
  `ics.worker.ts` is actually loaded at runtime) is created from a `blob:`
  URL by every major bundler. Refusing it doesn't stop an attacker; it stops
  a completely ordinary way to move work off the main thread.
- `connect-src: blob:` — a blob URL is this tab's own memory, so reading one
  back opens no network path that `'self'` didn't already allow. `src/lib/io`
  doesn't need it today (`File.text()` isn't a fetch), but several common
  file-reading helpers are written as `fetch(objectURL)` and there's no
  reason to make that a surprise.
- `script-src: 'wasm-unsafe-eval'` — permits _compiling WebAssembly_, not
  evaluating arbitrary strings as script. An in-browser SQLite (`sql.js`,
  `wa-sqlite`) or any other WASM-based local-first engine needs this and
  gets nothing else from it. Nothing here uses it yet; it's headroom.

This is looser than `listula`'s CSP, which this skeleton's structure was
otherwise drawn from — deliberately. `listula` holds a decryption key in
browser memory for the life of the tab, so _any_ successful injection there
is a full compromise, and its CSP is tuned to that specific, high-stakes
threat model. A generic skeleton with no secret in memory doesn't get to
borrow that posture for free; doing so would just make "add a worker" or
"add a WASM dependency" a fight with the framework the day a real feature
needs one, in exchange for a defence that isn't actually defending anything
here. See `docs/PATTERNS.md` for the fuller comparison.

## Security headers

`vercel.json` sets HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
`X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`, a
one-directive `Content-Security-Policy: frame-ancestors 'none'`, and a
restrictive `Permissions-Policy`.

**That CSP header is not a duplicate of the app's CSP, and it isn't
belt-and-braces either — it's the only copy that works.** The app's real
policy is generated by SvelteKit into a `<meta>` tag (see § Content Security
Policy), and `frame-ancestors` is ignored in a meta CSP by specification.
SvelteKit knows this and drops the directive when it writes the tag, so on a
prerendered page — which is every page here — the app's own CSP says nothing
about framing at all. Verified by reading the built
`.svelte-kit/output/prerendered/pages/index.html`, which is worth doing after
any CSP change rather than trusting the config. Two policies delivered by
different means both apply, and a policy declaring only `frame-ancestors`
restricts only framing, so this costs nothing else. `X-Frame-Options` stays
alongside it for older browsers, and `pnpm gates` now checks the header is
still in the file.

`vercel.json` deliberately does **not** set
`Cross-Origin-Embedder-Policy: require-corp` or
`Cross-Origin-Resource-Policy` — both are correct once an app talks to
nothing but its own origin (see `listula`'s `CLAUDE.md` for that posture),
but they break loading a third-party image, font, or embed the moment one is
added, and this skeleton doesn't get to assume that in advance. Add both the
day the app actually is fully self-origin, not before.

## Deployment (Vercel, Hobby/free tier)

1. **Import the repository** into a new Vercel project. Framework preset
   SvelteKit; build command and output directory are auto-detected via
   `@sveltejs/adapter-vercel`. Production deploys from `main`, previews from
   pull requests — no deploy step in `.github/workflows/ci.yml` on purpose.
2. **Confirm the free-tier numbers** at `vercel.com/docs/limits` before
   relying on them. Hobby is for personal, non-commercial use; if this ever
   earns money it moves to Pro.
3. **Add environment variables** as the project grows past having none — see
   `.env.example`. For local development: `vercel link`, then `vercel env
pull .env.local`.
4. **Protect `main`**: require CI green before merge, squash merges,
   conventional commit titles.
5. **Check the deployed preview** for what only a deploy can show: the
   response headers from `vercel.json`, Lighthouse on mobile, and (if a
   manifest is ever added) the installability audit.

## Bootstrapping a new project from this skeleton

See [AGENTS.md § Bootstrapping](./AGENTS.md#bootstrapping), then
[STACK.md § Bootstrapping, the stack half](./STACK.md#bootstrapping-the-stack-half),
for the checklist — it's kept there rather than here because it's the thing
a session picks up on its very first turn in a freshly-templated repo.

## Self-improving: the mechanics

The rationale is in [AGENTS.md § Self-improving: closing the loop](./AGENTS.md#self-improving-closing-the-loop);
this is how the two pieces actually work.

`scripts/gates.sh` appends one JSON line per run to `.claude/logs/gates.jsonl`
(gitignored — see `.gitignore`'s comment on it): a timestamp, the short
commit SHA, overall pass/fail, and a `pass`/`fail` per named check. It's
built with `printf`/`awk` rather than `jq`, so nothing here depends on a
tool that might not be on the machine running it. Query it locally, e.g.:

```bash
jq -s 'group_by(.checks[].name) | map({name: .[0].checks[0].name})' \
  .claude/logs/gates.jsonl   # crude; a real query groups per check name
```

or simpler, count failures per check across a session:

```bash
jq -c '.checks[]' .claude/logs/gates.jsonl | sort | uniq -c
```

This log is intentionally not uploaded anywhere, not attached to CI, and not
aggregated across machines — the moment it became infrastructure, it would
need its own security review, retention policy and opt-out, for a signal
that's genuinely only useful to whoever is sitting at that keyboard, right
now, deciding whether a rule still earns its keep.

`TEMPLATE_FEEDBACK.md` is the durable half: committed, human-written (or
agent-written, prompted by `pnpm feedback "..."`), and read manually,
periodically, by whoever maintains `osseus` itself — across every project
templated from it, since each accumulates its own copy. What's proven true
across more than one project's feedback file is a good candidate to fold
back into this repo's own `AGENTS.md` or `STACK.md` (whichever layer it
belongs to), `scripts/gates.sh`, or `vite.config.ts`, and the lesson itself,
with its evidence, into `docs/LEARNINGS.md`. Then the folded entries are
deleted from the project's feedback file, which only ever holds what hasn't
been dealt with.

**What's worth logging, concretely**, if you're wondering what "friction"
means in practice:

- A gate firing on legitimate code (false positive) vs. actually catching
  something (true positive) — the former belongs in `TEMPLATE_FEEDBACK.md`
  even if you just narrow the gate's own pattern rather than removing it.
- A CSP directive or security header that had to change for a real feature,
  and what that feature was — this is exactly how **§ Content Security
  Policy**'s `blob:`/`wasm-unsafe-eval` allowances should have kept
  happening if this project needed more of them.
- A dependency added in the first week that "the skeleton should have had" —
  a strong signal for what to add to `osseus` itself, versus a dependency
  added for something genuinely project-specific, which isn't.
- The bundle budget getting raised, and by what feature — a pattern of
  "every project raises it for X" means either the budget or the default
  approach to X is wrong.
- A CI failure that turned out to be the pipeline's fault, not the code's
  (flaky Playwright step, a cache that went stale) — these are invisible to
  `gates.jsonl` (CI runners are ephemeral; the log never survives past one
  run there) and only visible if someone writes them down.

## Dependencies

osseus starts with none and asks that each be a decision. visus decided, in
0.2.0, that the parts other people have already tested — loaders, spatial
indexes, XR input, schema checks — are better taken than hand-rolled. Each
one, and what it replaced:

| Library                                                           | Does                                                                                             | Replaced                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `three`                                                           | Scene, renderer, WebXR session, glTF/COLLADA loaders                                             | —                                                                   |
| `camera-controls`                                                 | Desktop orbit, pan, zoom-to-cursor, animated fly-to                                              | three's `OrbitControls`; jumps between views                        |
| `valibot`                                                         | Schemas for notes, views and imported files; types from them                                     | Hand-written type guards                                            |
| `idb-keyval`                                                      | IndexedDB for the last model opened                                                              | Hand-written request plumbing                                       |
| three's loaders                                                   | FBX, OBJ + MTL; Draco, Meshopt and KTX2 decoders                                                 | Refusing those files                                                |
| `three-mesh-bvh`                                                  | Spatial index on every mesh; fast raycasts and walking                                           | Testing every triangle, every frame                                 |
| `@gltf-transform/*`                                               | Optimising many-mesh models on open: dedup, instance, flatten, join, weld, prune                 | Drawing every exported mesh separately                              |
| `@carbon/icons`                                                   | IBM Carbon's icons, on the page (`Icon.svelte`) and drawn into the headset's panels (`panel.ts`) | Hand-drawn SVG paths                                                |
| `@fontsource/ibm-plex-mono`, `@fontsource-variable/ibm-plex-sans` | IBM Plex, served from this origin                                                                | The system font                                                     |
| `bits-ui`                                                         | Headless, accessible dialogs, tooltips, a toggle group and a switch, styled by `app.css`         | Native `<dialog>`, `title` attributes, a hand-drawn checkbox switch |
| `yjs`                                                             | A model's notes, views and sketches as a CRDT: merging imports, multi-step undo                  | Plain lists in localStorage; one snapshot of undo                   |

**glTF-Transform without its pixel tools.** Its functions package imports
`ndarray-pixels` and `ndarray-lanczos` for texture work, and `ndarray-ops`
under them compiles code with `new Function` as soon as it's imported — which
the CSP refuses, so the whole loader failed to load. `vite.config.ts`
aliases all three to `src/lib/viewer/no-pixels.ts`, which throws if called;
`optimise.ts` uses none of them and tells `prune` to keep solid textures,
its one route to pixels. `e2e/models.e2e.ts` runs the optimiser under the
real policy, so a change that reaches for them fails a test.

**A component library, headless.** osseus rules out component libraries
by default; Bits UI is taken because it brings behaviour, not looks —
focus trapping, Escape, tooltips that work on keyboard focus, radio
semantics for the background picker — and every pixel is still this
project's CSS. Its parts render at the end of `<body>`, outside scoped
styles, so their styling is global (`app.css`, "Parts drawn by Bits UI").

**Carbon's install telemetry stays off.** `@carbon/icons` depends on
`@ibm/telemetry-js`, which runs at install to report usage to IBM. pnpm runs
no dependency's install script unless `pnpm-workspace.yaml` lists it in
`onlyBuiltDependencies`, and it isn't listed there — keep it that way.

**Icons are built element by element.** `Icon.svelte` renders Carbon's
description of each icon (`elem`, `attrs`) with `<svelte:element>`, never
markup strings, and sets `xmlns` explicitly: without it, an icon created in
the browser rather than prerendered gets HTML-namespaced `<path>`s that
draw nothing. `e2e/smoke.e2e.ts` checks every path on the page is SVG.

One three.js only: `pnpm-workspace.yaml` overrides every dependency's copy
to ours, because `@pmndrs/xr`'s emulator UI pins an older one, and two
copies means two sets of classes that fail each other's `instanceof`.

## Notes as a CRDT

From schema version 2, a model's notes, saved views and sketches live in
a Yjs document (`src/lib/store/doc.ts`): three maps keyed by id, each
value the plain item, replaced whole on an edit. localStorage holds the
document as one base64 update; JSON exports carry it next to the readable
lists. What that buys:

- **Import merges.** Two people's exports of the same model combine, edits
  to different notes never conflict, and the later edit to the same note
  wins. On top of the CRDT merge, anything the file lists that's missing
  here is added, so importing your own backup restores what was deleted
  since — as a pure CRDT, the newer deletion would silently win. Lists
  without Yjs state (Markdown, version 1 files) are added by id, and a
  Markdown note identical in text and place to one here is skipped.
- **Undo is a history**, a `Y.UndoManager` over the three maps with each
  change its own step (`captureTimeout: 0`). osseus's pattern keeps one
  snapshot; the deletion notice still offers exactly that one step, and
  Ctrl+Z walks further.

`notes.ts` still owns validity: every item read out of a document passes
its Valibot schema, and `migrate()` turns version 1 lists (and anything
else) into version 2, numbering items' `created` in their stored order so
the list keeps its order. Lists are drawn sorted by `created`, then id,
because merged items have no place in anyone else's list.
`e2e/storage.e2e.ts` loads version 1 data saved before the change.

## The viewer

**three.js is the one runtime dependency, on purpose.** WebXR hands an app a
WebGL context and head and controller poses and nothing else; between that
and a model on screen sit a scene graph, a renderer, and glTF and COLLADA
parsers. Writing those by hand is a project of its own, and the alternatives
(A-Frame, Babylon.js) are larger and bring a framework with them. three.js
is imported from `src/routes/+page.svelte` after first paint, so the page
arrives fast. Held back on purpose, and what would end it:

- **Controller models** (`XRControllerModelFactory`) fetch from a CDN, which
  `connect-src 'self'` refuses; a plain grip box is drawn instead. Vendoring
  the Quest's two controller meshes into `static/` would end that.

**How it moves you.** The headset owns the head's pose inside the play
space; the app owns only where the play space — the _dolly_ — sits, and how
the model's group is scaled and placed. Every move (`rig.ts`) is "where must
the dolly go so the head ends up there": cameras put the eyes on the eye
point, teleports put the feet on the floor, turning rotates about the head.
Scaling changes the model's group, never the dolly, so the eye distance
stays right. Notes and saved views are kept in model coordinates and
survive any scale.

**Sketches** are stored as the polylines they draw (`store/notes.ts`), in
model coordinates, lifted a hair off the surface they were drawn on so they
aren't half-buried in it. They're drawn with three's "fat lines"
(`LineSegments2`, one per sketch, `sketch-layer.ts`): plain WebGL lines are
one pixel whatever is asked, which vanishes in a headset, and widths in
screen pixels read the same at 1:1 and on a miniature. Their resolution is
the canvas on a screen and one eye's framebuffer in VR. The geometry —
stroke simplification, shapes on a surface's plane, arrowheads — is
`sketch.ts`, with tests.

**Text entry** inside an immersive session is the app's own job — there is
no system keyboard and no DOM overlay in `immersive-vr` — so menus and the
keyboard are canvases drawn with the 2D API on planes (`panel.ts`).

**COLLADA under Trusted Types.** `ColladaLoader` parses with
`DOMParser.parseFromString`, which `require-trusted-types-for 'script'`
treats as a sink even for XML. Rather than allow-list a policy that blesses
any string, `load.ts` parses the XML with `XMLHttpRequest` from a `blob:`
URL (`responseType: 'document'`, not a sink) and stands in for `DOMParser`
for the one synchronous `parse()` call. `e2e/models.e2e.ts` fails if that
path stops working under the real policy.

**Compressed glTF and the `default` Trusted Types policy.** three.js's
Draco and KTX2 decoders run in Workers built from `blob:` URLs, and
`worker-src blob:` is not enough: under `require-trusted-types-for
'script'`, `new Worker(url)` wants a TrustedScriptURL, and the decoders pass
a string. `src/lib/trusted-types.ts` defines the browser's `default` policy
to let exactly that through — a `blob:` URL from this origin, as a script
URL — and nothing else: no HTML, no inline script, no other origin. The
gates allow `createPolicy` in that file only. The decoders' files are copied
from three.js into `static/decoders/` at install (`scripts/decoders.sh`), so
they always match the loader. `e2e/models.e2e.ts` opens Draco and Meshopt
fixtures (regenerated by `pnpm fixtures`) under the real policy.

**`connect-src data:`** is the one directive widened for this app: a
`.gltf` exported with embedded buffers carries them as `data:` URIs, and
`GLTFLoader` fetches them. No network, nothing executed.

**Tested without a headset** through Meta's Immersive Web Emulation Runtime
(`iwer`, a devDependency injected only in `e2e/xr.e2e.ts`): an emulated
Quest 3 whose controllers the tests press, push and move. It proves the
session starts under the CSP and every control is wired and doesn't throw;
comfort, frame rate and legibility still need a headset. Headless Chromium
draws WebGL only with its software renderer switched on — see the launch
flags in `playwright.config.ts`.

## Known limits

- **No component-level test runner.** `vitest` here covers pure logic only
  (`src/**/*.test.ts`); components are verified by driving them with
  Playwright in a real browser, not by mounting them in `jsdom`. Add
  `@testing-library/svelte` and a `jsdom` environment the day that stops
  being enough — don't add it speculatively. When you do, keep `node` the
  default and opt each DOM-needing file in with a first-line
  `// @vitest-environment jsdom`: `kalendes` had jsdom global, and its
  per-file setup was over half the suite's wall time (6.8s → 4.5s once only
  the 10 of 26 files that needed it paid for it).
- **No PWA / offline support out of the box.** Both sibling projects this
  skeleton draws from ship one; this one doesn't, because not every app
  wants the install prompt, the manifest, and the service-worker update
  dance. Adding one is a `vite-plugin-pwa` install plus a manifest, not an
  architecture change.
- **No component library, no CSS framework, no crypto library** — matching
  the sibling projects. Pull one in deliberately, with the trade-off written
  down, rather than by default.
- **Undo is one step, not a stack.** `notesStore.undoable` holds a single
  snapshot, taken before a remove or a replace, and any constructive edit
  retires it — undoing a delete after three further edits would take those
  edits with it, which isn't what the word means to whoever pressed it. A
  real editor wants `listula`'s approach (stamp a new change forward rather
  than rewind) or a proper history; this is the smallest honest version of
  "anything that can lose data owes a way back".
- **A failed write is reported, not retried.** If `localStorage.setItem`
  throws — a full quota, a private window, blocked site data — the store
  sets `storageBroken` and the page says the notes won't survive a reload.
  There's no retry, no fallback to IndexedDB, and no queue. That's the right
  size for a skeleton; a project that genuinely can't lose data needs a real
  strategy, decided deliberately.
- **The feedback loop is manual, not automatic.** `TEMPLATE_FEEDBACK.md` and
  `.claude/logs/gates.jsonl` (see § Self-improving) don't report anywhere or
  aggregate across projects on their own — closing the loop back into
  `osseus` means someone actually reads a project's feedback file and
  decides what to change here. That's a deliberate trade against a
  telemetry pipeline this template has no server to run and no business
  collecting data through anyway.
