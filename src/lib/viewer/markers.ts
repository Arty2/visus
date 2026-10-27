import {
	Group,
	Mesh,
	MeshBasicMaterial,
	SphereGeometry,
	Vector3,
	type Object3D,
	type Sprite
} from 'three';
import type { Annotation } from '$lib/store/notes';
import { disposeLabel, makeLabel } from './panel';
import { hex } from './theme';

// The notes, drawn into the model: a pin where each was left and a label
// above it. They live inside the model's group so they move, turn and scale
// with it — but are resized every frame to hold one apparent size, so a note
// is as readable on a 1:200 model on a table as standing next to it at 1:1.

const PIN = new SphereGeometry(1, 16, 12);
const OPEN = new MeshBasicMaterial({ color: hex.note, depthTest: false });
const DONE = new MeshBasicMaterial({ color: hex.noteDone, depthTest: false });

// Angular sizes, as a fraction of distance. A pin is about half a degree; a
// label's height about two.
const PIN_SIZE = 0.006;
const LABEL_SIZE = 0.032;

interface Marker {
	pin: Mesh;
	label: Sprite;
	text: string;
	done: boolean;
}

export class Markers {
	readonly group = new Group();
	private readonly markers = new Map<string, Marker>();
	private readonly scratch = new Vector3();

	sync(notes: Pick<Annotation, 'id' | 'text' | 'done' | 'position'>[]) {
		const keep = new Set(notes.map((n) => n.id));
		for (const [id, m] of this.markers) {
			if (!keep.has(id)) {
				this.group.remove(m.pin, m.label);
				disposeLabel(m.label);
				this.markers.delete(id);
			}
		}

		for (const note of notes) {
			let m = this.markers.get(note.id);
			if (!m) {
				const pin = new Mesh(PIN, OPEN);
				pin.renderOrder = 4;
				pin.userData.noteId = note.id;
				m = { pin, label: makeLabel(note.text, note.done), text: note.text, done: note.done };
				m.label.userData.noteId = note.id;
				this.markers.set(note.id, m);
				this.group.add(pin, m.label);
			} else if (m.text !== note.text || m.done !== note.done) {
				this.group.remove(m.label);
				disposeLabel(m.label);
				m.label = makeLabel(note.text, note.done);
				m.label.userData.noteId = note.id;
				m.text = note.text;
				m.done = note.done;
				this.group.add(m.label);
			}
			m.pin.material = note.done ? DONE : OPEN;
			m.pin.position.fromArray(note.position);
			m.label.position.fromArray(note.position);
		}
	}

	/** Draws every label again — after a font has loaded, say. */
	refresh() {
		const notes = [...this.markers.entries()].map(([id, m]) => ({
			id,
			text: m.text,
			done: m.done,
			position: m.pin.position.toArray() as [number, number, number]
		}));
		this.clear();
		this.sync(notes);
	}

	/** Things a pointer can hit — pins and their labels. */
	targets(): Object3D[] {
		if (!this.group.visible) return [];
		return [...this.markers.values()].flatMap((m) => [m.pin, m.label]);
	}

	/** Holds every marker at one apparent size, seen from `eye` (world space). */
	resize(eye: Vector3, worldScale: number) {
		for (const m of this.markers.values()) {
			const d = m.pin.getWorldPosition(this.scratch).distanceTo(eye);
			const pin = Math.min(0.5, Math.max(0.006, d * PIN_SIZE)) / worldScale;
			m.pin.scale.setScalar(pin);
			const h = Math.min(2, Math.max(0.02, d * LABEL_SIZE)) / worldScale;
			m.label.scale.set(h * (m.label.userData.aspect as number), h, 1);
		}
	}

	clear() {
		this.sync([]);
	}
}
