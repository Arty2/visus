import { browser } from '$app/environment';
import {
	SCHEMA_VERSION,
	emptyNotes,
	migrate,
	newAnnotation,
	newViewpoint,
	type Annotation,
	type ModelNotes,
	type Persisted,
	type Vec3,
	type Viewpoint
} from './notes';

// One key per model, one versioned shape under each. Prefixed with the
// project name so this app can share a browser profile with its siblings.
const PREFIX = 'visus:notes:';

function load(key: string): ModelNotes {
	try {
		const raw = localStorage.getItem(PREFIX + key);
		return raw ? migrate(JSON.parse(raw)) : emptyNotes();
	} catch {
		// Corrupt JSON under our own key, or storage that throws on read.
		// Starting empty beats a crash on load.
		return emptyNotes();
	}
}

// What a destructive action left behind, so it can be put back. One step.
export interface Undoable {
	label: string;
	notes: ModelNotes;
}

// The thin reactive layer: $state holds the open model's notes, every change
// goes through persist(), and anything that can lose data keeps one step of
// undo. Which model is open is set by open(); until then nothing is stored.
class NotesStore {
	key = $state<string | null>(null);
	annotations = $state<Annotation[]>([]);
	viewpoints = $state<Viewpoint[]>([]);
	undoable = $state<Undoable | null>(null);
	/** True once a write has actually failed — see persist(). */
	storageBroken = $state(false);

	open(key: string) {
		const notes = browser ? load(key) : emptyNotes();
		this.key = key;
		this.annotations = notes.annotations;
		this.viewpoints = notes.viewpoints;
		this.undoable = null;
	}

	addAnnotation(position: Vec3, text = ''): Annotation {
		const note = newAnnotation(text.trim(), position);
		this.annotations.push(note);
		this.undoable = null;
		this.persist();
		// The proxy, not `note`: the caller may go on to edit it.
		return this.annotations[this.annotations.length - 1];
	}

	setText(id: string, text: string) {
		const note = this.annotations.find((a) => a.id === id);
		if (!note || note.text === text) return;
		note.text = text;
		this.undoable = null;
		this.persist();
	}

	toggle(id: string) {
		const note = this.annotations.find((a) => a.id === id);
		if (!note) return;
		note.done = !note.done;
		this.undoable = null;
		this.persist();
	}

	removeAnnotation(id: string) {
		const note = this.annotations.find((a) => a.id === id);
		if (!note) return;
		this.remember(note.text ? `Deleted “${note.text}”.` : 'Deleted a note.');
		this.annotations = this.annotations.filter((a) => a.id !== id);
		this.persist();
	}

	/**
	 * A note left with nothing in it — placed, then the keyboard closed — is
	 * dropped without an undo offer: nothing was written, so nothing is lost.
	 */
	discardIfEmpty(id: string) {
		const note = this.annotations.find((a) => a.id === id);
		if (!note || note.text.trim()) return;
		this.annotations = this.annotations.filter((a) => a.id !== id);
		this.persist();
	}

	addViewpoint(position: Vec3, yaw: number, name?: string): Viewpoint {
		const view = newViewpoint(name ?? `View ${this.viewpoints.length + 1}`, position, yaw);
		this.viewpoints.push(view);
		this.undoable = null;
		this.persist();
		return view;
	}

	renameViewpoint(id: string, name: string) {
		const view = this.viewpoints.find((v) => v.id === id);
		const trimmed = name.trim();
		if (!view || !trimmed || view.name === trimmed) return;
		view.name = trimmed;
		this.undoable = null;
		this.persist();
	}

	removeViewpoint(id: string) {
		const view = this.viewpoints.find((v) => v.id === id);
		if (!view) return;
		this.remember(`Deleted “${view.name}”.`);
		this.viewpoints = this.viewpoints.filter((v) => v.id !== id);
		this.persist();
	}

	/** Import: all or nothing, and undoable — it may have been the wrong file. */
	replace(notes: ModelNotes, label: string) {
		this.remember(label);
		this.annotations = notes.annotations;
		this.viewpoints = notes.viewpoints;
		this.persist();
	}

	undo() {
		if (!this.undoable) return;
		this.annotations = this.undoable.notes.annotations;
		this.viewpoints = this.undoable.notes.viewpoints;
		this.undoable = null;
		this.persist();
	}

	snapshot(): ModelNotes {
		return {
			annotations: $state.snapshot(this.annotations) as Annotation[],
			viewpoints: $state.snapshot(this.viewpoints) as Viewpoint[]
		};
	}

	// A snapshot, not a spread: the arrays hold deep reactive proxies, and a
	// shallow copy would hand undo the same objects the live list mutates.
	private remember(label: string) {
		this.undoable = { label, notes: this.snapshot() };
	}

	private persist() {
		if (!browser || this.key === null) return;
		const payload: Persisted = { version: SCHEMA_VERSION, ...this.snapshot() };
		try {
			localStorage.setItem(PREFIX + this.key, JSON.stringify(payload));
			this.storageBroken = false;
		} catch {
			// A full quota or a browser refusing storage. The notes still work
			// in this tab; what's gone is durability, and the page says so.
			this.storageBroken = true;
		}
	}
}

export const notesStore = new NotesStore();
