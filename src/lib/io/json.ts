import * as v from 'valibot';
import {
	AnnotationSchema,
	SCHEMA_VERSION,
	uniqueIds,
	ViewpointSchema,
	type ModelNotes
} from '$lib/store/notes';

// The export is also a valid Persisted (see store/notes.ts): a downloaded
// file and a localStorage record are one shape, so there's one thing to keep
// in step. The model's name rides along for whoever opens the file later; it
// isn't read back, because notes are imported into whichever model is open.
export function toJSON(notes: ModelNotes, model: string): string {
	return JSON.stringify({ version: SCHEMA_VERSION, model, ...notes }, null, '\t') + '\n';
}

// Stricter than migrate() on purpose: corrupt storage falls back to empty
// because there's nothing else to do, but a file someone chose to import
// should say what was wrong with it. An empty file parses to empty lists —
// whether to apply that is the caller's decision (see +page.svelte).
// Either list may be missing; anything else in the file is ignored.
const NotesFile = v.object({
	annotations: v.optional(v.array(AnnotationSchema), []),
	viewpoints: v.optional(v.array(ViewpointSchema), [])
});

export function fromJSON(text: string): ModelNotes {
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

	const { annotations, viewpoints } = result.output;
	return { annotations: uniqueIds(annotations), viewpoints: uniqueIds(viewpoints) };
}
