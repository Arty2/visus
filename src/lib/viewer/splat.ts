import { Group, Mesh, MeshStandardMaterial, type Object3D, type WebGLRenderer } from 'three';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { allowOwnBlobWorkers } from '$lib/trusted-types';
import { isGaussianPly, SPLAT_FORMATS, type Format } from './files';

/*
 * Gaussian splats — photographic scans of real places, from a phone app or
 * a drone — drawn by Spark (World Labs). A scan opens like any model: notes,
 * sketches, views, walking and VR all work on it, because Spark's SplatMesh
 * raycasts and its renderer draws into the same scene and both eyes.
 *
 * Spark decodes in Workers built from blob: URLs (our Trusted Types policy
 * passes exactly those) and compiles WebAssembly ('wasm-unsafe-eval' is
 * allowed). It's imported only when a scan is opened: it's large, and most
 * models aren't scans.
 */

/** True for a file that opens as a splat scan rather than a mesh. */
export async function isSplat(file: File, format: Format): Promise<boolean> {
	if (SPLAT_FORMATS.includes(format)) return true;
	if (format !== 'ply') return false;
	return isGaussianPly(await file.slice(0, 4096).text());
}

/**
 * A scan, upright. Training tools write splats Y-down (the camera
 * convention they come from), so they're turned half over about X, as
 * Spark's own examples do. The scene graph is root → scan, with Spark's
 * renderer alongside, so disposing the root disposes all of it.
 */
export async function loadSplat(file: File, renderer: WebGLRenderer): Promise<Object3D> {
	allowOwnBlobWorkers();
	const { SplatMesh, SparkRenderer } = await import('@sparkjsdev/spark');
	const scan = new SplatMesh({ fileBytes: await file.arrayBuffer(), fileName: file.name });
	await scan.initialized;
	scan.quaternion.set(1, 0, 0, 0);
	scan.userData.isSplat = true;

	const root = new Group();
	root.name = file.name;
	root.add(scan, new SparkRenderer({ renderer }));
	root.userData.splat = scan;
	return root;
}

/** A mesh PLY (from a scanner or MeshLab), with its vertex colours if it has them. */
export async function loadMeshPly(file: File): Promise<Object3D> {
	const geometry = new PLYLoader().parse(await file.arrayBuffer());
	if (!geometry.attributes.normal) geometry.computeVertexNormals();
	const material = new MeshStandardMaterial({
		vertexColors: !!geometry.attributes.color,
		roughness: 0.85
	});
	const root = new Group();
	root.name = file.name;
	root.add(new Mesh(geometry, material));
	return root;
}
