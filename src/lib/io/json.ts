import * as v from 'valibot';
import type { Incoming } from '$lib/store/notes.svelte';
import {
	AnnotationSchema,
	byCreated,
	SCHEMA_VERSION,
	SketchSchema,
	uniqueIds,
	ViewpointSchema,
	type ModelNotes
} from '$lib/store/notes';

// A visus notes file: the lists, readable and hand-editable, and the Yjs
// state they came from (store/doc.ts), which is what lets an import merge
// two people's work as a CRDT rather than one overwriting the other. A file
// without it — hand-written, or from before 0.2 — still imports, by id. The
// model's name rides along for whoever opens the file; it isn't read back,
// because notes are imported into whichever model is open.
export function toJSON(notes: ModelNotes, model: string, yjs?: string): string {
	return (
		JSON.stringify(
			{ version: SCHEMA_VERSION, model, ...notes, ...(yjs ? { yjs } : {}) },
			null,
			'\t'
		) + '\n'
	);
}

// Stricter than migrate() on purpose: corrupt storage falls back to empty
// because there's nothing else to do, but a file someone chose to import
// should say what was wrong with it. An empty file parses to empty lists —
// whether to apply that is the caller's decision (see +page.svelte). Every
// list may be missing; anything else in the file is ignored. `created` is
// optional (version 1 files have none), so version 1 files read as they are.
const NotesFile = v.object({
	annotations: v.optional(v.array(AnnotationSchema), []),
	viewpoints: v.optional(v.array(ViewpointSchema), []),
	sketches: v.optional(v.array(SketchSchema), []),
	yjs: v.optional(v.string())
});

export function fromJSON(text: string): Incoming {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error('That file is not valid JSON.');
	}

	const result = v.safeParse(NotesFile, parsed);
	if (!result.success) {
		// The path says where: "annotations.2.position" beats "invalid".
		const where = v.getDotPath(result.issues[0]);
		throw new Error(`That JSON is not a recognised set of notes${where ? ` (at ${where})` : ''}.`);
	}

	const { annotations, viewpoints, sketches, yjs } = result.output;
	return {
		notes: {
			annotations: uniqueIds(annotations).sort(byCreated),
			viewpoints: uniqueIds(viewpoints).sort(byCreated),
			sketches: uniqueIds(sketches).sort(byCreated)
		},
		...(yjs ? { yjs } : {})
	};
}
