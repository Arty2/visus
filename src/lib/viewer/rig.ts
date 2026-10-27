import { Vector3, type Quaternion } from 'three';

// The arithmetic of moving a person through a model in VR, kept apart from
// the renderer so it can be tested. The headset owns the head's pose inside
// the play space; the app owns only where that play space (the "dolly") sits
// in the world, and how the model is scaled and placed inside it. Every move
// below is therefore "where must the dolly go so the head ends up there".

const UP = new Vector3(0, 1, 0);

/** Yaw of an orientation, radians about +Y; 0 faces −Z (three.js forward). */
export function yawOf(q: Quaternion): number {
	const f = new Vector3(0, 0, -1).applyQuaternion(q);
	return Math.atan2(-f.x, -f.z);
}

/** The level direction a yaw faces. */
export function forwardOf(yaw: number): Vector3 {
	return new Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
}

/**
 * Where the dolly goes, and how it turns, so that a head at `head` (its
 * position inside the dolly, as the headset reports it) facing `headYaw` ends
 * up exactly at `eye` facing `yaw`. Height included: a saved camera is where
 * the eyes were, so the floor lands wherever that puts it.
 */
export function placeHead(head: Vector3, headYaw: number, eye: Vector3, yaw: number) {
	const dollyYaw = yaw - headYaw;
	const offset = head.clone().applyAxisAngle(UP, dollyYaw);
	return { position: eye.clone().sub(offset), yaw: dollyYaw };
}

/**
 * Where the dolly goes so the person stands on `feet` without turning: the
 * head's level offset is cancelled, its height kept, and the play-space floor
 * put at the target's height.
 */
export function placeFeet(head: Vector3, dollyYaw: number, feet: Vector3): Vector3 {
	const offset = head.clone().applyAxisAngle(UP, dollyYaw);
	return new Vector3(feet.x - offset.x, feet.y, feet.z - offset.z);
}

/**
 * Turning on the spot: the dolly rotates about the head rather than about its
 * own origin, which is somewhere on the floor of the play space and would
 * swing the person sideways with every snap.
 */
export function turnAboutHead(dollyPosition: Vector3, dollyYaw: number, head: Vector3, by: number) {
	const before = head.clone().applyAxisAngle(UP, dollyYaw).add(dollyPosition);
	const yaw = dollyYaw + by;
	const after = head.clone().applyAxisAngle(UP, yaw).add(dollyPosition);
	return { position: dollyPosition.clone().add(before.sub(after)), yaw };
}

/** Rescaling an object about a fixed point: where its origin moves to. */
export function scaleAbout(position: Vector3, from: number, to: number, pivot: Vector3): Vector3 {
	return position
		.clone()
		.sub(pivot)
		.multiplyScalar(to / from)
		.add(pivot);
}

// The architectural scales, largest first. Two-hand scaling snaps to one when
// it passes close, and overview picks the largest that fits on a table.
export const SCALES = [
	1,
	1 / 2,
	1 / 5,
	1 / 10,
	1 / 20,
	1 / 50,
	1 / 100,
	1 / 200,
	1 / 500,
	1 / 1000
];
export const MIN_SCALE = 1 / 5000;
export const MAX_SCALE = 1;

/** The largest standard scale at which `size` metres fits in `room` metres. */
export function fitScale(size: number, room = 1.2): number {
	if (!(size > 0)) return 1;
	return SCALES.find((s) => size * s <= room) ?? MIN_SCALE;
}

/** Clamps a free scale, and snaps it to a standard one within 6%. */
export function snapScale(s: number): number {
	const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
	const near = SCALES.find((preset) => Math.abs(clamped / preset - 1) < 0.06);
	return near ?? clamped;
}

/** "1:1", "1:50", "1:137" — how an architect writes a scale. */
export function scaleLabel(s: number): string {
	if (!(s > 0)) return '1:1';
	const n = 1 / s;
	return n >= 1 ? `1:${Math.round(n)}` : `${Math.round(s)}:1`;
}
