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
| Left stick                   | Walk, in the direction you're looking                                     |
| Right stick forward, release | Teleport. Aim at the miniature to step into it at 1:1                     |
| Right stick left / right     | Turn by 30°                                                               |
| A / B                        | Next / previous view                                                      |
| X                            | Place a note where the right hand points                                  |
| Y                            | Open or close the menu                                                    |
| One grip                     | Grab the world and pull yourself through it                               |
| Both grips                   | Scale and turn the model; snaps to 1:1, 1:10, 1:20, 1:50, 1:100…          |
| Trigger                      | Press a menu button or key; point at a note to edit, resolve or delete it |

The **menu** has the scales (_Fit_ chooses the largest that fits on the
table; _1:1_ puts you life-size where the right hand points), previous and
next view, **Save view**, **Add note**, notes shown or hidden, and **Exit
VR**.

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

A note can be **resolved** (ticked) rather than deleted. Deleting one, or
importing over them, can be undone once.

**Export Markdown** writes the notes as a checklist anyone can read, each
with where it is pinned in metres:

```
# Notes on house.dae

- [ ] Handrail missing on the landing @ 2.150, 3.000, -4.400
- [x] Door swings into the corridor @ -1.200, 0.000, 6.800
```

**Export JSON** writes the notes and the saved views. Either imports back
into whichever model is open; an import with nothing in it is refused.

## What leaves this machine

Nothing. Models are read from the files you pick, in the browser; notes,
views and the last model opened stay in this browser's storage. The page
makes no requests beyond loading itself.

## Limitations

- **Formats**: no `.skp`, `.ifc`, `.3dm` or `.usdz`; export to glTF,
  FBX, COLLADA or OBJ. OBJ carries no cameras and no units.
- **Size**: a model has to fit in the headset's memory, and every triangle
  is drawn every frame. Large SketchUp exports with dense furniture or
  vegetation may stutter; purge unused components and hide what isn't needed
  before exporting.
- **Teleporting and placing notes** test against every mesh in the model,
  so on very large models the teleport arc can lag behind the hand.
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
