// Regenerates the compressed glTF fixtures in e2e/fixtures from floor.gltf,
// so they can be remade with the encoders' current versions rather than
// trusted as opaque binaries: `node scripts/fixtures.mjs`.
import { NodeIO } from '@gltf-transform/core';
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
