import { describe, expect, it } from 'vitest';
import {
	BoxGeometry,
	CompressedTexture,
	Group,
	InstancedMesh,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial
} from 'three';
import { count, hasCompressedTextures, OPTIMISE_FROM, shouldOptimise } from './optimise';

describe('count', () => {
	it('counts meshes, and the triangles every instance draws', () => {
		const root = new Group();
		root.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial())); // 12 triangles
		root.add(new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 10)); // 120
		expect(count(root)).toEqual({ meshes: 2, triangles: 132 });
	});
});

describe('shouldOptimise', () => {
	it('leaves small models as they came', () => {
		expect(shouldOptimise({ meshes: OPTIMISE_FROM - 1, triangles: 1e6 }, false)).toBe(false);
		expect(shouldOptimise({ meshes: OPTIMISE_FROM, triangles: 10 }, false)).toBe(true);
	});

	it('leaves models with GPU-compressed textures alone', () => {
		expect(shouldOptimise({ meshes: 5000, triangles: 1e6 }, true)).toBe(false);
	});
});

describe('hasCompressedTextures', () => {
	it('finds a compressed texture in any material slot', () => {
		const material = new MeshStandardMaterial();
		const root = new Group().add(new Mesh(new BoxGeometry(), material));
		expect(hasCompressedTextures(root)).toBe(false);
		material.roughnessMap = new CompressedTexture([], 1, 1);
		expect(hasCompressedTextures(root)).toBe(true);
	});
});
