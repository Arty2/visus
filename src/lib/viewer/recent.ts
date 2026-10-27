import { createStore, del, get, set } from 'idb-keyval';

// The last model opened, kept in IndexedDB so the headset doesn't need the
// file picker again after a reload. Files, not a URL: they're what the
// person chose, and IndexedDB stores File objects as they are. idb-keyval
// is the wrapper rather than hand-written request plumbing: it's tiny,
// widely used and tested, and promise-shaped already.
//
// Every failure here is quiet on purpose. Losing this costs one trip to the
// file picker; it isn't data the person made, unlike their notes.

// Its own database rather than idb-keyval's shared default, so it's
// recognisable in devtools and can't collide with anything else.
const store = () => createStore('visus', 'recent');
const KEY = 'last';

export async function rememberFiles(files: File[]): Promise<void> {
	try {
		await set(KEY, files, store());
	} catch {
		// Quota, a private window, or no IndexedDB: see above.
	}
}

export async function recallFiles(): Promise<File[] | null> {
	try {
		const files: unknown = await get(KEY, store());
		return Array.isArray(files) && files.every((f) => f instanceof File) ? files : null;
	} catch {
		return null;
	}
}

export async function forgetFiles(): Promise<void> {
	try {
		await del(KEY, store());
	} catch {
		// See above.
	}
}
