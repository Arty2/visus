import { WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, instance, join, prune, weld } from '@gltf-transform/functions';
import type { Mesh, Object3D } from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/*
 * Model optimisation on open, with glTF-Transform. A headset draws every
 * mesh as its own draw call, every frame, twice (one per eye), and a
 * SketchUp export is typically thousands of small meshes — each chair, each
 * window pane, each tree leaf group. That, far more than triangle count, is
 * what makes a big model stutter on a Quest.
 *
 * Whatever the format, the loaded scene is exported to glTF in memory (three's
 * GLTFExporter), transformed, and loaded back:
 *
 * - dedup     — identical meshes, materials and textures become one
 * - instance  — a component repeated five times or more becomes one
 *               instanced mesh: one draw call for every chair in the hall
 * - flatten   — the node tree is baked flat, transforms kept
 * - join      — meshes that share a material become one mesh
 * - weld      — identical vertices are shared
 * - prune     — anything left unused is dropped
 *
 * Cameras survive (their nodes carry a camera, so nothing prunes them) and
 * the model's coordinates don't change, so notes stay where they were left.
 * Materials that aren't three's standard PBR (COLLADA's Lambert and Phong)
 * come back as standard ones — close, not identical, which is why this can
 * be switched off.
 */

/** Below this many meshes, a model is drawn as it is: there's little to win. */
export const OPTIMISE_FROM = 50;

export interface Counts {
	meshes: number;
	triangles: number;
}

export function count(root: Object3D): Counts {
	let meshes = 0;
	let triangles = 0;
	root.traverse((o) => {
		const mesh = o as Mesh;
		if (!mesh.isMesh) return;
		meshes++;
		const g = mesh.geometry;
		const n = g.index ? g.index.count : (g.attributes.position?.count ?? 0);
		const instances = (mesh as { count?: number }).count ?? 1;
		triangles += (n / 3) * instances;
	});
	return { meshes, triangles: Math.round(triangles) };
}

/**
 * Whether a scene is worth optimising, and safe to. A scene with GPU-
 * compressed (KTX2) textures is left alone: GLTFExporter can't write them,
 * and such a file was optimised by whoever compressed it.
 */
export function shouldOptimise(counts: Counts, hasCompressedTextures: boolean): boolean {
	return counts.meshes >= OPTIMISE_FROM && !hasCompressedTextures;
}

export function hasCompressedTextures(root: Object3D): boolean {
	let found = false;
	root.traverse((o) => {
		const material = (o as Mesh).material;
		if (!material || found) return;
		for (const m of Array.isArray(material) ? material : [material]) {
			for (const value of Object.values(m)) {
				if ((value as { isCompressedTexture?: boolean } | null)?.isCompressedTexture) found = true;
			}
		}
	});
	return found;
}

export async function optimise(root: Object3D): Promise<Object3D> {
	const glb = (await new GLTFExporter().parseAsync(root, {
		binary: true,
		onlyVisible: true
	})) as ArrayBuffer;

	const io = new WebIO().registerExtensions(ALL_EXTENSIONS);
	const doc = await io.readBinary(new Uint8Array(glb));
	// instance before join: join would otherwise merge the repeats into one
	// big mesh first, which is one draw call too, but with every copy's
	// vertices stored — instancing keeps one copy.
	// keepSolidTextures: detecting a one-colour texture means decoding its
	// pixels, which visus can't do here (see no-pixels.ts) — and keeping one
	// costs a few bytes, not a draw call.
	await doc.transform(
		dedup(),
		instance({ min: 5 }),
		flatten(),
		join(),
		weld(),
		prune({ keepSolidTextures: true })
	);
	const out = await io.writeBinary(doc);

	const gltf = await new GLTFLoader().parseAsync(
		out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer,
		''
	);
	return gltf.scene;
}
