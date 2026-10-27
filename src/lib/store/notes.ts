import * as v from 'valibot';

// What a review of one model leaves behind: notes pinned to points on it,
// viewpoints saved inside it, and sketches drawn over it. Nothing here knows about storage, three.js or
// the DOM — that's notes.svelte.ts and src/lib/viewer — so the rules about
// what counts as valid are plain functions a test can call directly.
//
// Positions are in the model's own coordinates (metres, Y up, as the loader
// hands the scene over), never in the room's: the model is scaled, turned and
// walked through in VR, and a note has to stay on the stair it was left on
// through all of that.

// The shapes are Valibot schemas, and the types are read off them, so the
// check and the type can't drift apart. A schema also says *what* was wrong
// with a file (see io/json.ts), where a hand-written guard could only say no.
const finite = v.pipe(v.number(), v.finite());

export const Vec3Schema = v.tuple([finite, finite, finite]);

/**
 * When an item was made, in milliseconds. Not shown anywhere: it's the
 * order lists are drawn in, because notes merged from someone else's file
 * (see store/doc.ts) arrive with no position in anyone's list. Version 1
 * data had none; migrate() numbers it 0, 1, 2… so it keeps its old order,
 * ahead of anything newer.
 */
const created = v.optional(finite, 0);

export const AnnotationSchema = v.object({
	id: v.string(),
	text: v.string(),
	/** Resolved — the `- [x]` of the Markdown export. */
	done: v.boolean(),
	position: Vec3Schema,
	created
});

export const ViewpointSchema = v.object({
	id: v.string(),
	name: v.string(),
	/** Where the eyes are. */
	position: Vec3Schema,
	/** Which way they face, radians about +Y; 0 looks down −Z. */
	yaw: finite,
	created
});

export const SKETCH_KINDS = ['pen', 'line', 'arrow', 'rect', 'ellipse'] as const;

/**
 * A mark drawn over the model: freehand, or a shape. Every kind is stored
 * the same way, as the polyline it draws — a rectangle as its four corners,
 * an ellipse as points round it — so drawing it back needs no geometry of
 * its own, and a file written by anything that can list points can make
 * one. Only an arrow's head is left to be drawn, from its last two points.
 */
export const SketchSchema = v.object({
	id: v.string(),
	kind: v.picklist(SKETCH_KINDS),
	colour: v.pipe(v.string(), v.regex(/^#[0-9a-f]{6}$/i)),
	points: v.pipe(v.array(Vec3Schema), v.minLength(2), v.maxLength(5000)),
	/** Which way is "out" from the surface it was drawn on, if any. */
	normal: v.optional(Vec3Schema),
	created
});

export type Vec3 = v.InferOutput<typeof Vec3Schema>;
export type Annotation = v.InferOutput<typeof AnnotationSchema>;
export type Viewpoint = v.InferOutput<typeof ViewpointSchema>;
export type Sketch = v.InferOutput<typeof SketchSchema>;
export type SketchKind = Sketch['kind'];

export interface ModelNotes {
	annotations: Annotation[];
	viewpoints: Viewpoint[];
	sketches: Sketch[];
}

// Bump this the day a shape changes, and add a branch to migrate() for the
// version it's coming from — never rewrite old data in place.
//   1 — notes and viewpoints, as plain lists
//   2 — sketches; every item has `created`; storage holds a Yjs document
export const SCHEMA_VERSION = 2;

export function emptyNotes(): ModelNotes {
	return { annotations: [], viewpoints: [], sketches: [] };
}

export function newAnnotation(text: string, position: Vec3): Annotation {
	return {
		id: crypto.randomUUID(),
		text,
		done: false,
		position: round(position),
		created: Date.now()
	};
}

export function newViewpoint(name: string, position: Vec3, yaw: number): Viewpoint {
	return {
		id: crypto.randomUUID(),
		name,
		position: round(position),
		yaw: roundTo(yaw, 4),
		created: Date.now()
	};
}

export function newSketch(kind: SketchKind, colour: string, points: Vec3[], normal?: Vec3): Sketch {
	return {
		id: crypto.randomUUID(),
		kind,
		colour,
		points: points.map(round),
		...(normal
			? { normal: [roundTo(normal[0], 3), roundTo(normal[1], 3), roundTo(normal[2], 3)] }
			: {}),
		created: Date.now()
	};
}

/** Oldest first, and by id between equals, so every copy agrees on order. */
export function byCreated<T extends { created: number; id: string }>(a: T, b: T): number {
	return a.created - b.created || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

// Millimetres are as fine as a note on a building needs, and six digits of
// float noise per axis make the Markdown export unreadable.
function round(v: Vec3): Vec3 {
	return [roundTo(v[0], 3), roundTo(v[1], 3), roundTo(v[2], 3)];
}

function roundTo(n: number, digits: number) {
	const f = 10 ** digits;
	// `|| 0` folds −0 into 0, which otherwise prints as "-0" in exports.
	return Math.round(n * f) / f || 0;
}

/**
 * The one key a model's notes are filed under. Name and size rather than a
 * content hash: hashing a 200 MB export on a headset is seconds of nothing
 * happening, and the pair is already unique enough to tell two revisions of
 * the same file apart — a re-export that changes the geometry changes the size.
 */
export function modelKey(name: string, size: number): string {
	return `${name}:${size}`;
}

// The only function allowed to know every schema version ever shipped.
// Anything read from storage passes through here; what isn't recognised is
// dropped rather than trusted.
//
// It reads plain lists: version 1 as stored, and version 2 as exported to
// JSON. Version 2 storage is a Yjs document, decoded by store/doc.ts, which
// comes back here for anything that isn't one.
export function migrate(raw: unknown): ModelNotes {
	if (!raw || typeof raw !== 'object') return emptyNotes();
	const persisted = raw as Partial<Record<keyof ModelNotes | 'version', unknown>>;

	if (persisted.version === 1) {
		// No `created` then: number them in their stored order.
		const numbered = (list: unknown) =>
			Array.isArray(list)
				? list.map((item, i) => (item && typeof item === 'object' ? { ...item, created: i } : item))
				: [];
		return migrate({
			version: 2,
			annotations: numbered(persisted.annotations),
			viewpoints: numbered(persisted.viewpoints),
			sketches: []
		});
	}

	if (persisted.version === SCHEMA_VERSION) {
		return {
			annotations: uniqueIds(valid(AnnotationSchema, persisted.annotations)).sort(byCreated),
			viewpoints: uniqueIds(valid(ViewpointSchema, persisted.viewpoints)).sort(byCreated),
			sketches: uniqueIds(valid(SketchSchema, persisted.sketches)).sort(byCreated)
		};
	}

	return emptyNotes();
}

/**
 * Every id once. A hand-edited or merged file can repeat one, and the lists
 * are keyed by id — a repeat doesn't just confuse, it stops the page drawing
 * the list at all. The first keeps its id; later ones get fresh ones.
 */
export function uniqueIds<T extends { id: string }>(items: T[]): T[] {
	const seen = new Set<string>();
	return items.map((item) => {
		if (!seen.has(item.id)) {
			seen.add(item.id);
			return item;
		}
		const id = crypto.randomUUID();
		seen.add(id);
		return { ...item, id };
	});
}

/** The items of a list that pass a schema — parsed, so unknown keys are dropped. */
function valid<S extends v.GenericSchema>(schema: S, list: unknown): v.InferOutput<S>[] {
	if (!Array.isArray(list)) return [];
	return list.flatMap((item) => {
		const result = v.safeParse(schema, item);
		return result.success ? [result.output] : [];
	});
}

export const isVec3 = (value: unknown): value is Vec3 => v.is(Vec3Schema, value);
export const isAnnotation = (value: unknown): value is Annotation => v.is(AnnotationSchema, value);
export const isViewpoint = (value: unknown): value is Viewpoint => v.is(ViewpointSchema, value);
export const isSketch = (value: unknown): value is Sketch => v.is(SketchSchema, value);
