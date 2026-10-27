import { Matrix4, Quaternion, Vector3, type Object3D } from 'three';
import type { Vec3 } from '$lib/store/notes';
import { yawOf } from './rig';

// A place to look from: a camera that came in the file, or a viewpoint saved
// here. One shape for both so the VR controls step through them as one list.
export interface ViewTarget {
	id: string;
	name: string;
	position: Vec3;
	yaw: number;
	/** Only file cameras have one, and only the desktop view can honour it. */
	pitch: number;
	saved: boolean;
}

/**
 * Exporters name cameras for machines. SketchUp writes each scene as
 * `skp_camera_<Scene_Name>`; Blender and others use the node's name.
 */
export function cleanCameraName(raw: string, fallback: string): string {
	const name = raw
		.replace(/^skp_camera_/i, '')
		.replace(/[_]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (!name) return fallback;
	return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Eye position, yaw and pitch from a camera's world matrix. */
export function viewFromMatrix(m: Matrix4) {
	const position = new Vector3();
	const q = new Quaternion();
	m.decompose(position, q, new Vector3());
	const forward = new Vector3(0, 0, -1).applyQuaternion(q);
	const pitch = Math.asin(Math.max(-1, Math.min(1, forward.y)));
	return { position, yaw: yawOf(q), pitch };
}

/**
 * Every camera in a loaded model, in model coordinates (the root's parent
 * space — the same space notes are pinned in). Camera objects often carry
 * no name of their own; the node holding them usually does.
 */
export function camerasIn(root: Object3D): ViewTarget[] {
	root.updateMatrixWorld(true);
	const rootParentInverse = root.parent ? root.parent.matrixWorld.clone().invert() : new Matrix4();
	const views: ViewTarget[] = [];
	const seen = new Set<string>();

	root.traverse((object) => {
		if (!(object as { isCamera?: boolean }).isCamera) return;
		const { position, yaw, pitch } = viewFromMatrix(
			rootParentInverse.clone().multiply(object.matrixWorld)
		);
		let name = cleanCameraName(
			object.name || object.parent?.name || '',
			`Camera ${views.length + 1}`
		);
		// Two cameras with one name are told apart rather than one hiding.
		for (let n = 2; seen.has(name); n++) name = `${name.replace(/ \d+$/, '')} ${n}`;
		seen.add(name);
		views.push({
			id: `file:${views.length}`,
			name,
			position: position.toArray() as Vec3,
			yaw,
			pitch,
			saved: false
		});
	});

	return views;
}
