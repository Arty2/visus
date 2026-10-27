import { Group, Vector2, type Raycaster } from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import type { Sketch } from '$lib/store/notes';
import { segmentsOf } from './sketch';

/*
 * Sketches drawn into the model: one LineSegments2 per sketch, from three's
 * "fat lines". Plain WebGL lines are one pixel wide whatever is asked, which
 * vanishes in a headset; these are widths in screen pixels, so a stroke
 * reads the same on a 1:1 wall and on a 1:200 miniature. They live inside
 * the model's group, so they move, turn and scale with it.
 */

const WIDTH = 4;

export class SketchLayer {
	readonly group = new Group();
	private readonly lines = new Map<string, { line: LineSegments2; sketch: Sketch }>();
	private preview: LineSegments2 | null = null;
	private readonly resolution = new Vector2(1, 1);

	sync(sketches: Sketch[]) {
		const keep = new Set(sketches.map((s) => s.id));
		for (const [id, { line }] of this.lines) {
			if (keep.has(id)) continue;
			this.drop(line);
			this.lines.delete(id);
		}
		for (const sketch of sketches) {
			const had = this.lines.get(sketch.id);
			if (had?.sketch === sketch) continue; // items are replaced whole on any edit
			if (had) this.drop(had.line);
			const line = this.make(sketch);
			line.userData.sketchId = sketch.id;
			this.lines.set(sketch.id, { line, sketch });
			this.group.add(line);
		}
	}

	/** The sketch being drawn, before it's kept — or nothing. */
	showPreview(sketch: Pick<Sketch, 'kind' | 'points' | 'normal' | 'colour'> | null) {
		if (this.preview) this.drop(this.preview);
		this.preview = null;
		if (!sketch || sketch.points.length < 2) return;
		this.preview = this.make(sketch);
		this.group.add(this.preview);
	}

	/** Pixel size of what's being drawn to — the canvas, or one eye in a headset. */
	setResolution(width: number, height: number) {
		this.resolution.set(width, height);
		for (const { line } of this.lines.values()) line.material.resolution.copy(this.resolution);
		this.preview?.material.resolution.copy(this.resolution);
	}

	/** The id of the sketch a ray passes within a few pixels of, if any. */
	pick(raycaster: Raycaster): string | null {
		raycaster.params.Line2 = { threshold: 8 };
		const lines = [...this.lines.values()].map((l) => l.line);
		const [hit] = raycaster.intersectObjects(lines, false);
		return (hit?.object.userData.sketchId as string | undefined) ?? null;
	}

	private make(sketch: Pick<Sketch, 'kind' | 'points' | 'normal' | 'colour'>): LineSegments2 {
		const geometry = new LineSegmentsGeometry().setPositions(segmentsOf(sketch));
		const material = new LineMaterial({
			color: sketch.colour,
			linewidth: WIDTH,
			worldUnits: false,
			resolution: this.resolution.clone()
		});
		const line = new LineSegments2(geometry, material);
		line.computeLineDistances();
		line.renderOrder = 3;
		return line;
	}

	private drop(line: LineSegments2) {
		this.group.remove(line);
		line.geometry.dispose();
		line.material.dispose();
	}
}
