// Regenerates the generated fixtures in e2e/fixtures — the compressed glTFs
// from floor.gltf, and blocks.glb, scan.splat and box.ply from nothing —
// so they can be remade with the encoders' current versions rather than
// trusted as opaque binaries: `node scripts/fixtures.mjs`.
import { writeFileSync } from 'node:fs';
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

// scan.splat: a small invented "scan" in antimatter15's .splat layout
// (32 bytes a splat: position, scale as float32s; RGBA and a rotation
// quaternion as bytes) — a 4 m square of ground with a low wall along one
// side, written Y-down as training tools write them, so the loader's
// upright turn is exercised.
{
	const splats = [];
	for (let i = 0; i < 40; i++) {
		for (let j = 0; j < 40; j++) {
			splats.push({ p: [-2 + i * 0.1, 0, -2 + j * 0.1], c: [196, 186, 160] });
		}
	}
	for (let i = 0; i < 40; i++) {
		for (let k = 1; k <= 10; k++)
			splats.push({ p: [-2 + i * 0.1, k * 0.1, -2], c: [255, 131, 43] });
	}
	const bytes = new Uint8Array(splats.length * 32);
	const view = new DataView(bytes.buffer);
	splats.forEach(({ p, c }, n) => {
		const o = n * 32;
		// Y-down: the up of this scene is −Y in the file.
		[p[0], -p[1], p[2]].forEach((v, k) => view.setFloat32(o + k * 4, v, true));
		[0.06, 0.06, 0.06].forEach((v, k) => view.setFloat32(o + 12 + k * 4, v, true));
		bytes.set([...c, 255], o + 24);
		bytes.set([255, 128, 128, 128], o + 28); // the identity rotation
	});
	writeFileSync('e2e/fixtures/scan.splat', bytes);
	console.log('wrote scan.splat');
}

// box.ply: a mesh PLY (ASCII, eight corners, six faces), to check a .ply
// that isn't a scan opens as a mesh.
{
	const v = [
		[0, 0, 0],
		[1, 0, 0],
		[1, 1, 0],
		[0, 1, 0],
		[0, 0, 1],
		[1, 0, 1],
		[1, 1, 1],
		[0, 1, 1]
	];
	const f = [
		[0, 3, 2, 1],
		[4, 5, 6, 7],
		[0, 1, 5, 4],
		[2, 3, 7, 6],
		[1, 2, 6, 5],
		[0, 4, 7, 3]
	];
	const ply = [
		'ply',
		'format ascii 1.0',
		'comment hand-written fixture',
		`element vertex ${v.length}`,
		'property float x',
		'property float y',
		'property float z',
		`element face ${f.length}`,
		'property list uchar int vertex_indices',
		'end_header',
		...v.map((p) => p.join(' ')),
		...f.map((q) => `4 ${q.join(' ')}`),
		''
	].join('\n');
	writeFileSync('e2e/fixtures/box.ply', ply);
	console.log('wrote box.ply');
}
