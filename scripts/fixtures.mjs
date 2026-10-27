// Regenerates the compressed glTF fixtures in e2e/fixtures from floor.gltf,
// so they can be remade with the encoders' current versions rather than
// trusted as opaque binaries: `node scripts/fixtures.mjs`.
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, meshopt } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
	'draco3d.encoder': await draco3d.createEncoderModule(),
	'draco3d.decoder': await draco3d.createDecoderModule(),
	'meshopt.encoder': MeshoptEncoder,
	'meshopt.decoder': MeshoptDecoder
});

const source = 'e2e/fixtures/floor.gltf';
for (const [name, compress] of [
	['floor.draco.glb', draco()],
	['floor.meshopt.glb', meshopt({ encoder: MeshoptEncoder })]
]) {
	const doc = await io.read(source);
	await doc.transform(compress);
	await io.write(`e2e/fixtures/${name}`, doc);
	console.log('wrote', name);
}

// blocks.glb: sixty identical blocks, each its own mesh, and a camera — the
// shape of a SketchUp export with a repeated component, for the optimiser
// (dedup should find one mesh, instance should draw it once).
{
	const doc = new Document();
	const buffer = doc.createBuffer();
	// A 0.5 m cube: 8 corners, 12 triangles.
	const p = [
		[0, 0, 0],
		[0.5, 0, 0],
		[0.5, 0.5, 0],
		[0, 0.5, 0],
		[0, 0, 0.5],
		[0.5, 0, 0.5],
		[0.5, 0.5, 0.5],
		[0, 0.5, 0.5]
	].flat();
	const i = [
		0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6, 1, 2, 6, 1, 6, 5, 0, 4,
		7, 0, 7, 3
	];
	const material = doc.createMaterial('concrete').setBaseColorFactor([0.7, 0.7, 0.68, 1]);
	const scene = doc.createScene('blocks');
	for (let n = 0; n < 60; n++) {
		const position = doc
			.createAccessor()
			.setType('VEC3')
			.setArray(new Float32Array(p))
			.setBuffer(buffer);
		const indices = doc
			.createAccessor()
			.setType('SCALAR')
			.setArray(new Uint16Array(i))
			.setBuffer(buffer);
		const prim = doc
			.createPrimitive()
			.setAttribute('POSITION', position)
			.setIndices(indices)
			.setMaterial(material);
		const mesh = doc.createMesh(`block ${n}`).addPrimitive(prim);
		scene.addChild(
			doc
				.createNode(`block ${n}`)
				.setMesh(mesh)
				.setTranslation([(n % 10) * 1.2, 0, Math.floor(n / 10) * 1.2])
		);
	}
	const camera = doc
		.createCamera('Overlook')
		.setType('perspective')
		.setYFov(1)
		.setZNear(0.1)
		.setAspectRatio(1.5);
	scene.addChild(doc.createNode('Overlook').setCamera(camera).setTranslation([5, 1.6, 12]));
	await io.write('e2e/fixtures/blocks.glb', doc);
	console.log('wrote blocks.glb');
}
