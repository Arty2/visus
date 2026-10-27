# visus

**visus** is a viewer for 3D models in a Meta Quest 3. Open a building or
an object exported from SketchUp, Blender or anything else that writes glTF
or COLLADA, put the headset on, and walk through it at full size — or shrink
it to a model on a table and look down on it. Jump between the cameras
saved in the file, save views of your own, and pin notes to the places that
need attention. It runs in the Quest's own browser; nothing to install, and
the model never leaves the device.

- **Source** — [github.com/arty2/visus](https://github.com/arty2/visus)

## Name

Latin _vīsus_ — sight, a vision; also the thing seen.

## Opening a model

**Open model…** takes `.glb`, `.gltf`, `.fbx`, `.dae` and `.obj`. Pick the
model and its textures together (or the `.gltf` with its `.bin`, or the
`.obj` with its `.mtl`): the browser hands files over without their
folders, so visus matches each texture by its file name. Anything the model
asks for that wasn't picked is listed, and the model is shown without it.
Compressed glTF — Draco or Meshopt geometry, KTX2 textures — opens too.

| From      | Export as                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| SketchUp  | **File → Export → 3D Model → COLLADA (.dae)**. Each Scene becomes a camera; tick _Export texture maps_.    |
| Blender   | **File → Export → glTF 2.0**, format _glTF Binary (.glb)_, with _Cameras_ ticked.                          |
| Elsewhere | glTF 2.0, FBX, COLLADA 1.4 or OBJ. Units are read from the file where it has them; OBJ is taken as metres. |

**Large models are optimised as they open.** A model made of many separate
meshes — every SketchUp export with furniture in it — is merged by material,
and repeated components (chairs, windows, trees) are drawn as one instanced
mesh, which is what keeps a Quest at full frame rate. Positions, cameras and
notes are unchanged; COLLADA's simpler materials come back as standard ones,
close but not identical. The page says what it did, and **Optimise large
models**, at the foot of the page, turns it off.

**Scans** open too: Gaussian splats (`.spz`, `.splat`, `.ksplat`, or a
`.ply` written by a splat trainer) — the photographic captures phone apps
and drones make of real places. Notes, sketches, views, walking and VR work
on a scan as on a model, so the existing site can be reviewed the same
way. A scan is turned upright as it opens; a `.ply` that is a mesh rather
than a scan opens as a mesh.

`.skp` files can't be read directly — SketchUp's own format isn't open. The
last model opened is remembered, so after a reload **Reopen** brings it back
without the file picker. **Sample** opens a small pavilion to try things on.

On the Quest, files come from the headset's own storage: download them in
the Quest Browser, or copy them over USB into _Download_.

## In the headset

**Enter VR** starts. The model appears as a miniature on a table in front of
you, with the menu open.

| Control                      | Does                                                                      |
| ---------------------------- | ------------------------------------------------------------------------- |
| Left stick                   | Walk where you look; at 1:1, up stairs and stopped by walls               |
| Right stick forward, release | Teleport. Aim at the miniature to step into it at 1:1                     |
| Right stick left / right     | Turn by 30°                                                               |
| A / B                        | Next / previous view                                                      |
| X                            | Place a note where the right hand points                                  |
| Y                            | Open or close the menu                                                    |
| One grip                     | Grab the world and pull yourself through it                               |
| Both grips                   | Scale and turn the model; snaps to 1:1, 1:10, 1:20, 1:50, 1:100…          |
| Trigger                      | Press a menu button or key; point at a note to edit, resolve or delete it |

The **menu** has **Draw** (see Sketches), the scales (_Fit_ chooses the largest that fits on the
table; _1:1_ puts you life-size where the right hand points), previous and
next view, **Save view**, **Add note**, notes shown or hidden, and **Exit
VR**.

**Walking** at 1:1 keeps you on the model's floors: steps and ramps carry
you up and down, and walls, railings and furniture taller than a step stop
you. Where there's no floor within reach — the edge of a terrace — you keep
your height rather than fall. Teleporting and grabbing the world go
anywhere, walls included.

**Views** are the cameras saved in the model — SketchUp's Scenes, Blender's
cameras — followed by the ones you saved. Going to a view puts your eyes
where the camera was, facing its way, life-size; which way you look up or
down is left to you.

**Notes** are typed on a keyboard that appears in front of you. Shift comes
on by itself at the start of a sentence; shifted, comma and full stop give
`?` and `!`.

The controllers give a short buzz when a press, a teleport or a grab takes
effect.

Hand tracking works for pointing and pinching at the menu and keyboard;
pinching at empty space opens the menu. Walking, teleporting and scaling
need the controllers.

## Sketches

Mark up the model as you would a print. On a screen, the rail down the
left of the view holds the tools — **Pen**, **Line**, **Arrow**,
**Rectangle**, **Ellipse** and **Eraser** — and six colours. Choose one and
drag on the model: a mark starts on whatever surface you press, and
rectangles and ellipses lie flat on it. Choosing the tool again, or Esc,
puts it down. The eraser takes away the sketch you click.

In the headset, **Draw** on the menu turns the trigger into a pen: hold it
and move your hand to draw in the air, around or through the model.

Sketches stay where they were drawn as the model is scaled and turned,
are kept with the model's notes, go out in **Export JSON**, and come back
in on import. **Clear sketches** in the Notes panel removes them all,
one step to undo.

## Background

The model is shown against white unless you choose otherwise. The four
buttons in the corner of the view switch between **White**, **Studio**
(a mid grey), **Sky** (a daylight sky, with the sun lighting the model from
where it's drawn) and **Night**; in the headset, the menu's background
button steps through the same four. The choice is remembered.

## On a screen

The same page works without a headset. Drag or the arrow keys to orbit,
right-drag or shift and the arrows to pan, scroll or `+` and `−` to zoom
toward the pointer. Click a view's name to fly to it, and
**Save this view** to keep the current one; saved views can be renamed or
deleted in the list. **Add note**, then click the model, places a note (Esc
cancels); type in the list beside it. **Controls**, at the foot of the page,
lists every control for both.

## Notes and views

Notes belong to a model: each opened file keeps its own, saved in this
browser and found again whenever the same file is reopened. A file
re-exported with changes is a new file, with notes of its own — export the
old ones and import them if they still apply.

A note can be **resolved** (ticked) rather than deleted. **Ctrl+Z** (⌘Z on
a Mac) steps back through every change to notes, views and sketches, and
**Shift+Ctrl+Z** forward again; deleting something also offers **Undo**
right where it happened.

**Export Markdown** writes the notes as a checklist anyone can read, each
with where it is pinned in metres:

```
# Notes on house.dae

- [ ] Handrail missing on the landing @ 2.150, 3.000, -4.400
- [x] Door swings into the corridor @ -1.200, 0.000, 6.800
```

**Export JSON** writes everything — notes, saved views, sketches — and
the history that lets two copies be merged.

**Importing merges.** Nothing you have is deleted or replaced: everything
in the file is added to what's here, so a colleague's review and yours end
up as one, and importing your own backup brings back anything deleted
since. Where you both edited the same note, the later edit wins. A Markdown
file adds its notes, skipping any identical to one already here. An import
with nothing in it is refused, and any import can be undone.

## What leaves this machine

Nothing. Models are read from the files you pick, in the browser; notes,
views and the last model opened stay in this browser's storage. The page
makes no requests beyond loading itself.

## Limitations

- **Formats**: no `.skp`, `.ifc`, `.3dm` or `.usdz`; export to glTF,
  FBX, COLLADA or OBJ. OBJ carries no cameras and no units. A scan and a
  model can't yet be opened together, one inside the other.
- **Scans** are shown as captured: very large ones (millions of splats)
  may run below the headset's frame rate, and pointing at one is slower
  than at a mesh.
- **Size**: a model has to fit in the headset's memory, and every triangle
  is drawn every frame. Large SketchUp exports with dense furniture or
  vegetation may stutter; purge unused components and hide what isn't needed
  before exporting.
- **Animation** in the model isn't played; its cameras are used as still
  views.
- **Saved views and notes** are kept per browser. Clearing site data, or a
  private window, loses them — export to keep them.
- **One person**: there's no sharing a session with someone else in VR.

## Development

```
pnpm install
pnpm dev
pnpm test
```

Instructions for working on it are in [AGENTS.md](./AGENTS.md) and
[STACK.md](./STACK.md); [TECHNICAL.md](./TECHNICAL.md) has the CI, the
gates, the security policy and the deployment runbook.

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

## License

MIT — see [LICENSE](./LICENSE).

## Credit

Dialectic Acheiropoieton of Heracles Papatheodorou and Claude. Built on the
[osseus](https://github.com/arty2/osseus) skeleton, with
[three.js](https://threejs.org).
