// What a review of one model leaves behind: notes pinned to points on it, and
// viewpoints saved inside it. Nothing here knows about storage, three.js or
// the DOM — that's notes.svelte.ts and src/lib/viewer — so the rules about
// what counts as valid are plain functions a test can call directly.
//
// Positions are in the model's own coordinates (metres, Y up, as the loader
// hands the scene over), never in the room's: the model is scaled, turned and
// walked through in VR, and a note has to stay on the stair it was left on
// through all of that.

export type Vec3 = [number, number, number];

export interface Annotation {
	id: string;
	text: string;
	/** Resolved — the `- [x]` of the Markdown export. */
	done: boolean;
	position: Vec3;
}

export interface Viewpoint {
	id: string;
	name: string;
	/** Where the eyes are. */
	position: Vec3;
	/** Which way they face, radians about +Y; 0 looks down −Z. */
	yaw: number;
}

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
			annotations: uniqueIds(
				Array.isArray(persisted.annotations) ? persisted.annotations.filter(isAnnotation) : []
			),
			viewpoints: uniqueIds(
				Array.isArray(persisted.viewpoints) ? persisted.viewpoints.filter(isViewpoint) : []
			)
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

export function isVec3(value: unknown): value is Vec3 {
	return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

export function isAnnotation(value: unknown): value is Annotation {
	const a = value as Annotation;
	return (
		!!a &&
		typeof a === 'object' &&
		typeof a.id === 'string' &&
		typeof a.text === 'string' &&
		typeof a.done === 'boolean' &&
		isVec3(a.position)
	);
}

export function isViewpoint(value: unknown): value is Viewpoint {
	const v = value as Viewpoint;
	return (
		!!v &&
		typeof v === 'object' &&
		typeof v.id === 'string' &&
		typeof v.name === 'string' &&
		isVec3(v.position) &&
		Number.isFinite(v.yaw)
	);
}
