import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { arrowHead, ellipse, planeBasis, rectangle, segmentsOf, simplify } from './sketch';

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

describe('simplify', () => {
	it('drops points on a straight run and keeps the corner', () => {
		const line = [v(0, 0, 0), v(1, 0.001, 0), v(2, 0, 0), v(2, 1, 0), v(2, 2, 0)];
		expect(simplify(line, 0.01).map((p) => p.toArray())).toEqual([
			[0, 0, 0],
			[2, 0, 0],
			[2, 2, 0]
		]);
	});

	it('leaves two points alone', () => {
		expect(simplify([v(0, 0, 0), v(1, 0, 0)], 1)).toHaveLength(2);
	});
});

describe('planeBasis', () => {
	it('lies in the surface, square to the view where it can', () => {
		const { u, v: w } = planeBasis(v(0, 0, 1), v(1, 0.3, 0)); // a wall facing +Z
		expect(u.dot(v(0, 0, 1))).toBeCloseTo(0, 9);
		expect(w.dot(v(0, 0, 1))).toBeCloseTo(0, 9);
		expect(u.dot(w)).toBeCloseTo(0, 9);
		// The view's right already lies in a wall facing +Z, so u is just it.
		expect(u.distanceTo(v(1, 0.3, 0).normalize())).toBeCloseTo(0, 9);
	});

	it('still finds a direction when the view is square to the surface', () => {
		const { u } = planeBasis(v(0, 1, 0), v(0, 1, 0));
		expect(u.length()).toBeCloseTo(1, 9);
		expect(u.y).toBeCloseTo(0, 9);
	});
});

describe('rectangle and ellipse', () => {
	const { u, v: w } = planeBasis(v(0, 1, 0), v(1, 0, 0)); // on a floor: u = +X, v = −Z
	it('close, and span the corners given', () => {
		const r = rectangle(v(0, 0, 0), v(2, 0, -1), u, w);
		expect(r).toHaveLength(5);
		expect(r[0].equals(r[4])).toBe(true);
		expect(r[2].distanceTo(v(2, 0, -1))).toBeLessThan(1e-9);
		const e = ellipse(v(0, 0, 0), v(2, 0, -1), u, w, 32);
		expect(e[0].distanceTo(e[32])).toBeLessThan(1e-9);
		expect(e[0].distanceTo(v(2, 0, -0.5))).toBeLessThan(1e-9);
	});
});

describe('arrowHead', () => {
	it('puts two barbs behind the tip, either side, in the surface', () => {
		const [a, b] = arrowHead(v(0, 0, 0), v(4, 0, 0), v(0, 1, 0));
		for (const barb of [a, b]) {
			expect(barb.x).toBeLessThan(4);
			expect(barb.y).toBeCloseTo(0, 9);
		}
		expect(Math.sign(a.z)).toBe(-Math.sign(b.z));
		expect(v(4, 0, 0).distanceTo(a)).toBeCloseTo(0.4, 9); // capped
	});
});

describe('segmentsOf', () => {
	it('draws a polyline as pairs, and an arrow with its head', () => {
		const pts: [number, number, number][] = [
			[0, 0, 0],
			[1, 0, 0],
			[1, 1, 0]
		];
		expect(segmentsOf({ kind: 'pen', points: pts })).toHaveLength(2 * 6);
		expect(segmentsOf({ kind: 'arrow', points: pts.slice(0, 2) })).toHaveLength(3 * 6);
	});
});
