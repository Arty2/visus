import * as v from 'valibot';
import * as Y from 'yjs';
import {
	AnnotationSchema,
	byCreated,
	migrate,
	SCHEMA_VERSION,
	SketchSchema,
	ViewpointSchema,
	type ModelNotes
} from './notes';

/*
 * A model's notes as a Yjs document: a CRDT, so two copies edited apart —
 * a colleague's export and yours — merge into one with nothing lost and no
 * conflict to resolve by hand. That's what import does (see
 * notes.svelte.ts), and what a shared review session could build on.
 *
 * Three maps, keyed by id: annotations, viewpoints, sketches. Each value is
 * the plain item, replaced whole on any edit, so two people editing the same
 * note concurrently keep the later edit, and edits to different notes never
 * touch. Order isn't stored — lists are drawn by `created`.
 *
 * Plain functions over a Y.Doc, no storage or DOM: notes.ts still owns what
 * counts as valid, and every item read out of a document passes its schema.
 */

export const LISTS = ['annotations', 'viewpoints', 'sketches'] as const;
export type ListName = (typeof LISTS)[number];

const SCHEMAS = {
	annotations: AnnotationSchema,
	viewpoints: ViewpointSchema,
	sketches: SketchSchema
} as const;

export function listMap(doc: Y.Doc, list: ListName): Y.Map<unknown> {
	return doc.getMap(list);
}

/** Puts every item of `notes` into the document, by id, in one transaction. */
export function upsert(doc: Y.Doc, notes: Partial<ModelNotes>, origin?: unknown) {
	doc.transact(() => {
		for (const list of LISTS) {
			for (const item of notes[list] ?? []) listMap(doc, list).set(item.id, item);
		}
	}, origin);
}

/** The document as plain, validated lists, oldest first. */
export function readNotes(doc: Y.Doc): ModelNotes {
	const read = <L extends ListName>(list: L) =>
		[...listMap(doc, list).values()]
			.flatMap((item) => {
				const parsed = v.safeParse(SCHEMAS[list], item);
				return parsed.success ? [parsed.output] : [];
			})
			.sort(byCreated) as ModelNotes[L];
	return {
		annotations: read('annotations'),
		viewpoints: read('viewpoints'),
		sketches: read('sketches')
	};
}

export function docFrom(notes: ModelNotes): Y.Doc {
	const doc = new Y.Doc();
	upsert(doc, notes);
	return doc;
}

/** What storage holds for a model from version 2 on. */
export interface Stored {
	version: typeof SCHEMA_VERSION;
	/** The whole document as one Yjs update, base64. */
	yjs: string;
}

export function encode(doc: Y.Doc): string {
	return toBase64(Y.encodeStateAsUpdate(doc));
}

/** Merges an encoded document into `doc`. Throws if it isn't one. */
export function mergeEncoded(doc: Y.Doc, yjs: string, origin?: unknown) {
	Y.applyUpdate(doc, fromBase64(yjs), origin);
}

/**
 * Whatever was stored, as a document: version 2's Yjs state, or anything
 * older (or broken) through migrate(), the one function that knows every
 * version. A Yjs update that won't decode is treated like any other garbage.
 */
export function loadDoc(raw: unknown): Y.Doc {
	const stored = raw as Partial<Stored> | null;
	if (stored?.version === SCHEMA_VERSION && typeof stored.yjs === 'string') {
		const doc = new Y.Doc();
		try {
			mergeEncoded(doc, stored.yjs);
			return doc;
		} catch {
			return docFrom(migrate(null));
		}
	}
	return docFrom(migrate(raw));
}

// btoa/atob over a binary string, in chunks: Uint8Array.toBase64() would
// say it in one call, but isn't Baseline Widely available yet.
function toBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
	const binary = atob(text);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}
