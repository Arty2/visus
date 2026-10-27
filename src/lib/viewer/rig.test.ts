import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import {
	fitScale,
	forwardOf,
	placeFeet,
	placeHead,
	scaleAbout,
	scaleLabel,
	snapScale,
	turnAboutHead,
	yawOf
} from './rig';

const UP = new Vector3(0, 1, 0);
const close = (a: Vector3, b: Vector3) => expect(a.distanceTo(b)).toBeLessThan(1e-9);

// The head's world position, given a dolly placement — what the headset sees.
function headInWorld(dolly: Vector3, dollyYaw: number, head: Vector3) {
	return head.clone().applyAxisAngle(UP, dollyYaw).add(dolly);
}

describe('yawOf / forwardOf', () => {
	it('agree with each other all the way round', () => {
		for (const yaw of [0, 0.5, 1.5, 3, -2]) {
			const q = new Quaternion().setFromAxisAngle(UP, yaw);
			expect(yawOf(q)).toBeCloseTo(yaw, 9);
			close(forwardOf(yaw), new Vector3(0, 0, -1).applyQuaternion(q));
		}
	});

	it('ignores pitch', () => {
		const q = new Quaternion()
			.setFromAxisAngle(UP, 1)
			.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -0.7));
		expect(yawOf(q)).toBeCloseTo(1, 9);
	});
});

describe('placeHead', () => {
	it('puts the eyes exactly on the target, facing its way, wherever the person stands', () => {
		const head = new Vector3(0.4, 1.62, -0.3);
		const headYaw = 0.8;
		const eye = new Vector3(10, 1.7, -4);
		const { position, yaw } = placeHead(head, headYaw, eye, 2);
		close(headInWorld(position, yaw, head), eye);
		expect(yaw + headYaw).toBeCloseTo(2, 9);
	});
});

describe('placeFeet', () => {
	it('stands the person on the point, floor at its height, without turning them', () => {
		const head = new Vector3(0.4, 1.6, -0.3);
		const feet = new Vector3(5, 3, 2);
		const position = placeFeet(head, 1.1, feet);
		const world = headInWorld(position, 1.1, head);
		expect(world.x).toBeCloseTo(5, 9);
		expect(world.z).toBeCloseTo(2, 9);
		expect(world.y).toBeCloseTo(3 + 1.6, 9);
	});
});

describe('turnAboutHead', () => {
	it('turns without moving the head', () => {
		const dolly = new Vector3(2, 0, 3);
		const head = new Vector3(0.5, 1.6, -0.4);
		const { position, yaw } = turnAboutHead(dolly, 0.3, head, Math.PI / 6);
		expect(yaw).toBeCloseTo(0.3 + Math.PI / 6, 9);
		close(headInWorld(position, yaw, head), headInWorld(dolly, 0.3, head));
	});
});

describe('scaleAbout', () => {
	it('keeps the pivot where it was', () => {
		// A point p on an object at origin o, scale s, is at o + s·p. The pivot
		// is such a point; it must be in the same place before and after.
		const origin = new Vector3(1, 0, 2);
		const local = new Vector3(3, 1, -1);
		const pivot = local.clone().multiplyScalar(0.5).add(origin);
		const moved = scaleAbout(origin, 0.5, 0.01, pivot);
		close(local.clone().multiplyScalar(0.01).add(moved), pivot);
	});
});

describe('scales', () => {
	it('fits a building on a table and leaves a chair life-size', () => {
		expect(fitScale(40)).toBe(1 / 50);
		expect(fitScale(100)).toBe(1 / 100);
		expect(fitScale(0.9)).toBe(1);
		expect(fitScale(0)).toBe(1);
	});

	it('snaps near a standard scale and clamps outside the range', () => {
		expect(snapScale(1 / 52)).toBe(1 / 50);
		expect(snapScale(1 / 70)).toBeCloseTo(1 / 70, 12);
		expect(snapScale(3)).toBe(1);
		expect(snapScale(1e-9)).toBe(1 / 5000);
	});

	it('writes scales the way drawings do', () => {
		expect(scaleLabel(1)).toBe('1:1');
		expect(scaleLabel(1 / 50)).toBe('1:50');
		expect(scaleLabel(1 / 137.2)).toBe('1:137');
	});
});
