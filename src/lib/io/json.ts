import {
	isAnnotation,
	isViewpoint,
	SCHEMA_VERSION,
	uniqueIds,
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
export function fromJSON(text: string): ModelNotes {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error('That file is not valid JSON.');
	}

	const { annotations = [], viewpoints = [] } = (parsed ?? {}) as Partial<ModelNotes>;
	if (
		!parsed ||
		typeof parsed !== 'object' ||
		!Array.isArray(annotations) ||
		!Array.isArray(viewpoints) ||
		!annotations.every(isAnnotation) ||
		!viewpoints.every(isViewpoint)
	) {
		throw new Error('That JSON is not a recognised set of notes.');
	}

	return { annotations: uniqueIds(annotations), viewpoints: uniqueIds(viewpoints) };
}
