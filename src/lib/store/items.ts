// The shape of the local-first demo data, and nothing about how it's stored
// or rendered — that's items.svelte.ts and +page.svelte respectively. Kept
// separate so this file, the part with the actual rules, is plain functions
// a test can call without touching localStorage or the DOM.

export interface Item {
	id: string;
	text: string;
	done: boolean;
}

// Bump this the day the shape of Item changes, and add a branch to migrate()
// below for the version it's coming from — never rewrite old data in place.
// See AGENTS.md § Local-first data.
export const SCHEMA_VERSION = 1;

export interface Persisted {
	version: number;
	items: Item[];
}

export function newItem(text: string): Item {
	return { id: crypto.randomUUID(), text, done: false };
}

export function defaultItems(): Item[] {
	return [
		newItem('Replace this list with your own data model'),
		newItem('Export it (JSON or Markdown, below) to see the round trip')
	];
}

// The only function allowed to know about every schema version this project
// has ever shipped. Anything read from localStorage or an imported file goes
// through here before the rest of the app sees it — see TECHNICAL.md § Known
// limits for why that's a stronger guarantee than it looks.
export function migrate(raw: unknown): Item[] {
	if (!raw || typeof raw !== 'object') return defaultItems();
	const persisted = raw as Partial<Persisted>;

	// version 1 is the only version there's ever been; a future migration adds
	// `if (persisted.version === 1) { ... return upgraded }` above this line,
	// oldest first, and this function keeps falling through until it reaches a
	// shape it recognises.
	if (persisted.version === SCHEMA_VERSION && Array.isArray(persisted.items)) {
		return persisted.items.filter(isItem);
	}

	return defaultItems();
}

export function isItem(value: unknown): value is Item {
	return (
		!!value &&
		typeof value === 'object' &&
		typeof (value as Item).id === 'string' &&
		typeof (value as Item).text === 'string' &&
		typeof (value as Item).done === 'boolean'
	);
}
