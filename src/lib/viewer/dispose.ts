import type { Material, Mesh, Object3D, Texture } from 'three';

/**
 * Lets go of everything a model holds: geometry (and its BVH), materials,
 * and their textures — closing an ImageBitmap too, which otherwise keeps
 * its decoded pixels until the garbage collector gets round to it. Used
 * when a model is replaced, and on the original after optimising, when two
 * copies of a large model would otherwise sit in a headset's memory.
 */
export function disposeScene(root: Object3D) {
	root.traverse((o) => {
		const mesh = o as Mesh;
		if (!mesh.isMesh) return;
		mesh.geometry?.disposeBoundsTree?.();
		mesh.geometry?.dispose();
		const materials = (
			Array.isArray(mesh.material) ? mesh.material : [mesh.material]
		) as Material[];
		for (const m of materials) {
			for (const value of Object.values(m)) {
				const texture = value as Texture | null;
				if (!texture?.isTexture) continue;
				(texture.image as { close?: () => void } | undefined)?.close?.();
				texture.dispose();
			}
			m.dispose();
		}
	});
}
