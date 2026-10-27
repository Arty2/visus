// The last model opened, kept in IndexedDB so the headset doesn't need the
// file picker again after a reload. Files, not a URL: they're what the
// person chose, and IndexedDB stores File objects as they are. localStorage
// couldn't — it holds strings, and a few megabytes of them.
//
// Every failure here is quiet on purpose. Losing this costs one trip to the
// file picker; it isn't data the person made, unlike their notes.

const DB = 'visus';
const STORE = 'recent';
const KEY = 'last';

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function run<T>(
	mode: IDBTransactionMode,
	fn: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
	const db = await open();
	try {
		return await new Promise<T>((resolve, reject) => {
			const req = fn(db.transaction(STORE, mode).objectStore(STORE));
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
	} finally {
		db.close();
	}
}

export async function rememberFiles(files: File[]): Promise<void> {
	try {
		await run('readwrite', (s) => s.put(files, KEY));
	} catch {
		// Quota, a private window, or no IndexedDB: see above.
	}
}

export async function recallFiles(): Promise<File[] | null> {
	try {
		const files = await run<unknown>('readonly', (s) => s.get(KEY));
		return Array.isArray(files) && files.every((f) => f instanceof File) ? files : null;
	} catch {
		return null;
	}
}

export async function forgetFiles(): Promise<void> {
	try {
		await run('readwrite', (s) => s.delete(KEY));
	} catch {
		// See above.
	}
}
