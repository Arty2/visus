import { Vector3 } from 'three';
import type { Sketch, Vec3 } from '$lib/store/notes';

/*
 * The geometry of sketches, as plain functions. Every sketch is stored as
 * the polyline it draws (store/notes.ts); these make those polylines from a
 * gesture, and make line segments from them to draw.
 */

const UP = new Vector3(0, 1, 0);

/**
 * Ramer–Douglas–Peucker: drops points that lie within `tolerance` of the
 * line through their neighbours. A freehand stroke sampled every frame is
 * hundreds of points that say what a few dozen would.
 */
export function simplify(points: Vector3[], tolerance: number): Vector3[] {
	if (points.length < 3) return points.slice();
	const keep = new Array<boolean>(points.length).fill(false);
	keep[0] = keep[points.length - 1] = true;
	const stack: [number, number][] = [[0, points.length - 1]];
	const line = new Vector3();
	const offset = new Vector3();
	while (stack.length) {
		const [first, last] = stack.pop()!;
		line.subVectors(points[last], points[first]);
		const lengthSq = line.lengthSq();
		let worst = -1;
		let worstAt = -1;
		for (let i = first + 1; i < last; i++) {
			offset.subVectors(points[i], points[first]);
			const t = lengthSq ? Math.max(0, Math.min(1, offset.dot(line) / lengthSq)) : 0;
			const d = offset.addScaledVector(line, -t).length();
			if (d > worst) {
				worst = d;
				worstAt = i;
			}
		}
		if (worst > tolerance) {
			keep[worstAt] = true;
			stack.push([first, worstAt], [worstAt, last]);
		}
	}
	return points.filter((_, i) => keep[i]);
}

/**
 * Two directions lying in a surface, for drawing a rectangle or an ellipse
 * on it: `u` as close to the viewer's right as the surface allows (so a box
 * drawn on a wall is square to the screen), `v` across it.
 */
export function planeBasis(normal: Vector3, viewRight: Vector3) {
	const n = normal.clone().normalize();
	let u = viewRight.clone().addScaledVector(n, -viewRight.dot(n));
	if (u.lengthSq() < 1e-6) u = new Vector3().crossVectors(UP, n);
	if (u.lengthSq() < 1e-6) u = new Vector3(1, 0, 0);
	u.normalize();
	const v = new Vector3().crossVectors(n, u).normalize();
	return { u, v };
}

/** A rectangle with opposite corners `a` and `b`, closed (the first corner repeats). */
export function rectangle(a: Vector3, b: Vector3, u: Vector3, v: Vector3): Vector3[] {
	const d = b.clone().sub(a);
	const du = u.clone().multiplyScalar(d.dot(u));
	const dv = v.clone().multiplyScalar(d.dot(v));
	return [a.clone(), a.clone().add(du), a.clone().add(du).add(dv), a.clone().add(dv), a.clone()];
}

/** The ellipse inscribed in that rectangle, closed, as `segments` straight pieces. */
export function ellipse(a: Vector3, b: Vector3, u: Vector3, v: Vector3, segments = 48): Vector3[] {
	const d = b.clone().sub(a);
	const ru = d.dot(u) / 2;
	const rv = d.dot(v) / 2;
	const centre = a.clone().addScaledVector(u, ru).addScaledVector(v, rv);
	const points: Vector3[] = [];
	for (let i = 0; i <= segments; i++) {
		const t = (i / segments) * Math.PI * 2;
		points.push(
			centre
				.clone()
				.addScaledVector(u, ru * Math.cos(t))
				.addScaledVector(v, rv * Math.sin(t))
		);
	}
	return points;
}

/**
 * The two barbs of an arrowhead at `tip`, coming from `tail`: a quarter of
 * the shaft long (no more than 0.4 m), at 25°, lying in the surface the
 * arrow was drawn on — or upright, for one drawn in the air.
 */
export function arrowHead(tail: Vector3, tip: Vector3, normal?: Vector3): [Vector3, Vector3] {
	const back = tail.clone().sub(tip);
	const length = back.length();
	if (!length) return [tip.clone(), tip.clone()];
	back.divideScalar(length);
	const size = Math.min(length * 0.25, 0.4);
	let axis = normal ? normal.clone().normalize() : UP.clone();
	// An arrow pointing along the axis would have no side to put barbs on.
	if (Math.abs(axis.dot(back)) > 0.99) axis = new Vector3(1, 0, 0);
	const side = new Vector3().crossVectors(axis, back).normalize();
	const angle = (25 * Math.PI) / 180;
	const barb = (sign: number) =>
		tip
			.clone()
			.addScaledVector(back, size * Math.cos(angle))
			.addScaledVector(side, sign * size * Math.sin(angle));
	return [barb(1), barb(-1)];
}

/** A sketch as flat x, y, z pairs of segment ends — what a LineSegments geometry takes. */
export function segmentsOf(sketch: Pick<Sketch, 'kind' | 'points' | 'normal'>): number[] {
	const out: number[] = [];
	const p = sketch.points;
	for (let i = 1; i < p.length; i++) out.push(...p[i - 1], ...p[i]);
	if (sketch.kind === 'arrow' && p.length >= 2) {
		const tip = new Vector3(...p[p.length - 1]);
		const tail = new Vector3(...p[p.length - 2]);
		const normal = sketch.normal ? new Vector3(...sketch.normal) : undefined;
		for (const barb of arrowHead(tail, tip, normal)) out.push(...tip.toArray(), ...barb.toArray());
	}
	return out;
}

export const toVec3 = (p: Vector3): Vec3 => [p.x, p.y, p.z];

/** The marker colours offered — IBM Carbon's red, yellow, green, blue and purple, and ink. */
export const SKETCH_COLOURS = [
	{ name: 'Red', hex: '#fa4d56' },
	{ name: 'Yellow', hex: '#f1c21b' },
	{ name: 'Green', hex: '#42be65' },
	{ name: 'Blue', hex: '#4589ff' },
	{ name: 'Purple', hex: '#be95ff' },
	{ name: 'Ink', hex: '#161616' }
] as const;
