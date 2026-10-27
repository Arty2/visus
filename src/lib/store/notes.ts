import * as v from 'valibot';

// What a review of one model leaves behind: notes pinned to points on it, and
// viewpoints saved inside it. Nothing here knows about storage, three.js or
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

export const AnnotationSchema = v.object({
	id: v.string(),
	text: v.string(),
	/** Resolved — the `- [x]` of the Markdown export. */
	done: v.boolean(),
	position: Vec3Schema
});

export const ViewpointSchema = v.object({
	id: v.string(),
	name: v.string(),
	/** Where the eyes are. */
	position: Vec3Schema,
	/** Which way they face, radians about +Y; 0 looks down −Z. */
	yaw: finite
});

export type Vec3 = v.InferOutput<typeof Vec3Schema>;
export type Annotation = v.InferOutput<typeof AnnotationSchema>;
export type Viewpoint = v.InferOutput<typeof ViewpointSchema>;

export interface ModelNotes {
	annotations: Annotation[];
	viewpoints: Viewpoint[];
}

// Bump this the day either shape changes, and add a branch to migrate() for
// the version it's coming from — never rewrite old data in place.
export const SCHEMA_VERSION = 1;

export interface Persisted extends ModelNotes {
	version: number;
}

export function emptyNotes(): ModelNotes {
	return { annotations: [], viewpoints: [] };
}

export function newAnnotation(text: string, position: Vec3): Annotation {
	return { id: crypto.randomUUID(), text, done: false, position: round(position) };
}

export function newViewpoint(name: string, position: Vec3, yaw: number): Viewpoint {
	return { id: crypto.randomUUID(), name, position: round(position), yaw: roundTo(yaw, 4) };
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
export function migrate(raw: unknown): ModelNotes {
	if (!raw || typeof raw !== 'object') return emptyNotes();
	const persisted = raw as Partial<Persisted>;

	if (persisted.version === SCHEMA_VERSION) {
		return {
			annotations: uniqueIds(valid(AnnotationSchema, persisted.annotations)),
			viewpoints: uniqueIds(valid(ViewpointSchema, persisted.viewpoints))
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
