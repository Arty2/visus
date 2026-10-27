import { browser } from '$app/environment';
import { SCHEMA_VERSION, defaultItems, migrate, newItem, type Item, type Persisted } from './items';

// One key, one shape, versioned — see AGENTS.md § Local-first data. Prefixed
// with the project name the way every sibling project's localStorage keys
// are, so this app can share a browser profile with others of its kind
// without a collision.
const STORAGE_KEY = 'osseus:items';

function load(): Item[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? migrate(JSON.parse(raw)) : defaultItems();
	} catch {
		// Corrupt or foreign JSON under our own key — or a browser that throws
		// on reading storage at all. Starting fresh beats a crash on load.
		return defaultItems();
	}
}

// What a destructive action left behind, so it can be put back. One step
// only: a skeleton's job here is to show that anything which can lose data
// owes the user a way back, not to ship an undo stack.
export interface Undoable {
	/** Shown on the undo offer. Quoted where a name appears — see remove(). */
	label: string;
	items: Item[];
}

// A thin reactive wrapper over localStorage. This is the whole pattern to
// copy for a real data model: plain functions in a plain .ts file (items.ts)
// decide what's valid; this class's only job is holding it in $state, keeping
// localStorage in step, and keeping one step of undo. Nothing here is
// prerendering-unsafe — the `browser` check is what keeps the build (which
// runs in Node, with no localStorage) from ever calling load().
class ItemsStore {
	items = $state<Item[]>(browser ? load() : defaultItems());

	/** The last destructive action, until something else happens. */
	undoable = $state<Undoable | null>(null);

	/**
	 * True once a write has actually failed. Not inferred from anything —
	 * a browser that blocks storage looks identical to one that doesn't
	 * until you try to write. See persist().
	 */
	storageBroken = $state(false);

	add(text: string) {
		const trimmed = text.trim();
		if (!trimmed) return;
		this.items.push(newItem(trimmed));
		// Anything constructive retires the undo offer: undoing a delete after
		// three further edits would take those edits with it, which is not what
		// the word means to the person who pressed it.
		this.undoable = null;
		this.persist();
	}

	toggle(id: string) {
		const item = this.items.find((i) => i.id === id);
		if (!item) return;
		item.done = !item.done;
		this.undoable = null;
		this.persist();
	}

	remove(id: string) {
		const item = this.items.find((i) => i.id === id);
		if (!item) return;
		// Quoted here and unquoted in the button's accessible name, which is
		// listula's rule: a quotation mark disambiguates where the name stops
		// on screen, and is either noise or silence read aloud.
		this.remember(`Deleted “${item.text}”.`);
		this.items = this.items.filter((i) => i.id !== id);
		this.persist();
	}

	/**
	 * Used by import: replaces the whole list in one go, so an import that
	 * fails validation (see src/lib/io) never partially applies — and is
	 * undoable, because replacing everything is the most destructive thing
	 * this app can do and the file that did it may well have been the wrong
	 * file.
	 */
	replace(items: Item[], label = 'Replaced the list.') {
		this.remember(label);
		this.items = items;
		this.persist();
	}

	undo() {
		if (!this.undoable) return;
		this.items = this.undoable.items;
		this.undoable = null;
		this.persist();
	}

	// $state.snapshot, not a spread: the items are deep reactive proxies, and
	// a shallow copy would hand undo the same objects the live list is still
	// mutating.
	private remember(label: string) {
		this.undoable = { label, items: $state.snapshot(this.items) as Item[] };
	}

	private persist() {
		if (!browser) return;
		const payload: Persisted = { version: SCHEMA_VERSION, items: this.items };
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
			this.storageBroken = false;
		} catch {
			// A full quota, or a browser configured to refuse storage (private
			// windows and blocked-cookie settings both throw here). The list
			// still works in this tab; what's gone is durability, so the page
			// says so rather than looking like it saved.
			this.storageBroken = true;
		}
	}
}

export const itemsStore = new ItemsStore();
