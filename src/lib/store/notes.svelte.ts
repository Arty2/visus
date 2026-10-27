import { browser } from '$app/environment';
import * as Y from 'yjs';
import {
	encode,
	LISTS,
	listMap,
	loadDoc,
	mergeEncoded,
	readNotes,
	upsert,
	type Stored
} from './doc';
import {
	newAnnotation,
	newSketch,
	newViewpoint,
	SCHEMA_VERSION,
	type Annotation,
	type ModelNotes,
	type Sketch,
	type SketchKind,
	type Vec3,
	type Viewpoint
} from './notes';

// One key per model, one versioned shape under each. Prefixed with the
// project name so this app can share a browser profile with its siblings.
const PREFIX = 'visus:notes:';

// Who made a change, as Yjs records it. Local edits and imports can be
// undone; loading from storage and quietly dropping an unwritten note can't
// — undoing either would surprise.
const LOCAL = 'local';
const IMPORT = 'import';
const QUIET = 'quiet';

function read(key: string): unknown {
	try {
		const raw = localStorage.getItem(PREFIX + key);
		return raw ? JSON.parse(raw) : null;
	} catch {
		// Corrupt JSON under our own key, or storage that throws on read.
		// Starting empty beats a crash on load.
		return null;
	}
}

/** A destructive action's description, for the offer to undo it. */
export interface Undoable {
	label: string;
}

/** What an import brought: the lists it read, and the Yjs state if it had one. */
export interface Incoming {
	notes: ModelNotes;
	yjs?: string;
}

// The thin reactive layer over a model's Yjs document (store/doc.ts). The
// document is the truth; the three lists below are read out of it after
// every change, as plain frozen arrays, for the page and the viewer to
// draw. Every change goes through the document, so storage, undo and
// merging all see the same thing. Which model is open is set by open();
// until then nothing is stored.
class NotesStore {
	key = $state<string | null>(null);
	annotations = $state.raw<Annotation[]>([]);
	viewpoints = $state.raw<Viewpoint[]>([]);
	sketches = $state.raw<Sketch[]>([]);
	/** The last destructive action, offered for undoing until something else happens. */
	undoable = $state<Undoable | null>(null);
	/** True once a write has actually failed — see persist(). */
	storageBroken = $state(false);

	private doc = new Y.Doc();
	private history: Y.UndoManager | null = null;

	open(key: string) {
		this.history?.destroy();
		this.doc.destroy();
		this.doc = browser ? loadDoc(read(key)) : new Y.Doc();
		this.key = key;
		this.undoable = null;
		// Each change its own step: captureTimeout 0, or two edits a moment
		// apart would undo together.
		this.history = new Y.UndoManager(
			LISTS.map((list) => listMap(this.doc, list)),
			{ trackedOrigins: new Set([LOCAL, IMPORT]), captureTimeout: 0 }
		);
		this.doc.on('update', () => {
			this.refresh();
			this.persist();
		});
		this.refresh();
	}

	addAnnotation(position: Vec3, text = ''): Annotation {
		const note = newAnnotation(text.trim(), position);
		this.change(() => listMap(this.doc, 'annotations').set(note.id, note));
		return note;
	}

	setText(id: string, text: string) {
		const note = this.annotations.find((a) => a.id === id);
		if (!note || note.text === text) return;
		this.change(() => listMap(this.doc, 'annotations').set(id, { ...note, text }));
	}

	toggle(id: string) {
		const note = this.annotations.find((a) => a.id === id);
		if (!note) return;
		this.change(() => listMap(this.doc, 'annotations').set(id, { ...note, done: !note.done }));
	}

	removeAnnotation(id: string) {
		const note = this.annotations.find((a) => a.id === id);
		if (!note) return;
		this.change(
			() => listMap(this.doc, 'annotations').delete(id),
			note.text ? `Deleted “${note.text}”.` : 'Deleted a note.'
		);
	}

	/**
	 * A note left with nothing in it — placed, then the keyboard closed — is
	 * dropped without an undo offer: nothing was written, so nothing is lost.
	 */
	discardIfEmpty(id: string) {
		const note = this.annotations.find((a) => a.id === id);
		if (!note || note.text.trim()) return;
		this.doc.transact(() => listMap(this.doc, 'annotations').delete(id), QUIET);
	}

	addViewpoint(position: Vec3, yaw: number, name?: string): Viewpoint {
		const view = newViewpoint(name ?? `View ${this.viewpoints.length + 1}`, position, yaw);
		this.change(() => listMap(this.doc, 'viewpoints').set(view.id, view));
		return view;
	}

	renameViewpoint(id: string, name: string) {
		const view = this.viewpoints.find((v) => v.id === id);
		const trimmed = name.trim();
		if (!view || !trimmed || view.name === trimmed) return;
		this.change(() => listMap(this.doc, 'viewpoints').set(id, { ...view, name: trimmed }));
	}

	removeViewpoint(id: string) {
		const view = this.viewpoints.find((v) => v.id === id);
		if (!view) return;
		this.change(() => listMap(this.doc, 'viewpoints').delete(id), `Deleted “${view.name}”.`);
	}

	addSketch(kind: SketchKind, colour: string, points: Vec3[], normal?: Vec3): Sketch {
		const sketch = newSketch(kind, colour, points, normal);
		this.change(() => listMap(this.doc, 'sketches').set(sketch.id, sketch));
		return sketch;
	}

	removeSketch(id: string) {
		if (!this.sketches.some((s) => s.id === id)) return;
		this.change(() => listMap(this.doc, 'sketches').delete(id), 'Erased a sketch.');
	}

	clearSketches() {
		const count = this.sketches.length;
		if (!count) return;
		this.change(
			() => listMap(this.doc, 'sketches').clear(),
			`Cleared ${count} sketch${count === 1 ? '' : 'es'}.`
		);
	}

	/**
	 * Import: merges, never replaces, and never deletes.
	 *
	 * A file with Yjs state (any visus JSON export) merges as a CRDT, so a
	 * colleague's edits to notes you both have come in, the later edit
	 * winning where both changed one. Then anything the file lists that
	 * isn't here is added — which is what makes importing your own backup
	 * bring back a note deleted since (as a CRDT alone, the newer deletion
	 * would quietly win). Lists without Yjs state (Markdown, older exports)
	 * are added by id; a note without one that matches an existing note's
	 * text and place is skipped, so re-importing a Markdown export doesn't
	 * double everything. One step to undo, whatever it brought.
	 */
	merge(incoming: Incoming, from: string) {
		if (incoming.yjs) {
			try {
				mergeEncoded(this.doc, incoming.yjs, IMPORT);
			} catch {
				// Not a Yjs document after all: the lists still are notes.
			}
		}
		const here = readNotes(this.doc);
		const missing = <T extends { id: string }>(list: T[], have: T[]) =>
			list.filter((item) => !have.some((h) => h.id === item.id));
		const same = (a: Annotation, b: Annotation) =>
			a.text === b.text && a.position.every((n, i) => Math.abs(n - b.position[i]) < 1e-3);
		upsert(
			this.doc,
			{
				annotations: missing(incoming.notes.annotations, here.annotations).filter(
					(a) => !here.annotations.some((h) => same(a, h))
				),
				viewpoints: missing(incoming.notes.viewpoints, here.viewpoints),
				sketches: missing(incoming.notes.sketches, here.sketches)
			},
			IMPORT
		);
		this.undoable = { label: `Merged in “${from}”.` };
	}

	undo() {
		this.history?.undo();
		this.undoable = null;
	}

	redo() {
		this.history?.redo();
		this.undoable = null;
	}

	snapshot(): ModelNotes {
		return readNotes(this.doc);
	}

	/** The document's state, for exporting with the lists. */
	encoded(): string {
		return encode(this.doc);
	}

	// Anything constructive retires the undo offer: undoing a delete after
	// three further edits would take those edits with it, which is not what
	// the word means to the person who pressed it. (Ctrl+Z still steps back
	// through all of it, one change at a time.)
	private change(fn: () => void, destructive?: string) {
		this.doc.transact(fn, LOCAL);
		this.undoable = destructive ? { label: destructive } : null;
	}

	private refresh() {
		const notes = readNotes(this.doc);
		this.annotations = notes.annotations;
		this.viewpoints = notes.viewpoints;
		this.sketches = notes.sketches;
	}

	private persist() {
		if (!browser || this.key === null) return;
		const payload: Stored = { version: SCHEMA_VERSION, yjs: encode(this.doc) };
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
