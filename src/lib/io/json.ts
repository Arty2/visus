import { isItem, SCHEMA_VERSION, type Item } from '$lib/store/items';

// The export format is deliberately also a valid Persisted (see
// store/items.ts) — round-tripping through localStorage and through a
// downloaded file is the same shape, so there is only one thing to keep in
// step, not two.
export function toJSON(items: Item[]): string {
	return JSON.stringify({ version: SCHEMA_VERSION, items }, null, '\t') + '\n';
}

// Stricter than migrate() in store/items.ts on purpose: a corrupt
// localStorage record falls back to sensible defaults because there's
// nothing else to do, but a file someone deliberately imported should say
// clearly what was wrong with it rather than quietly replacing it with the
// starter list. Accepts either the wrapped export shape or a bare array, so
// a hand-written `[{...}, {...}]` works too.
//
// An empty list parses successfully and returns `[]` — a file this app
// exported always reads back in, whatever was in it. Whether an empty
// import should be *applied* is a different question, and it belongs to the
// caller, not to a format adapter: see +page.svelte, which refuses it once
// for both formats rather than each parser inventing its own policy.
export function fromJSON(text: string): Item[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error('That file is not valid JSON.');
	}

	const items = Array.isArray(parsed) ? parsed : (parsed as { items?: unknown } | null)?.items;

	if (!Array.isArray(items) || !items.every(isItem)) {
		throw new Error('That JSON is not a recognised item list.');
	}

	return items;
}
