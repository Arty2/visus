import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectErrors, expectModel, ready, reloaded } from './helpers';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

// Both loaders run under the full Content Security Policy here, which is the
// point: a .gltf with embedded buffers is fetched from data: URIs, and a .dae
// is parsed through a blob: URL because DOMParser is a Trusted Types sink.
// Either path breaking shows up as a console error, not as a failed request.

test('a glTF opens, with the camera it carries', async ({ page }) => {
	const errors = collectErrors(page);
	await ready(page);
	await page.getByLabel('Open model…').setInputFiles(fixture('floor.gltf'));
	await expectModel(page, 'floor.gltf');
	await expect(page.getByRole('button', { name: 'Doorway', exact: true })).toBeVisible();
	expect(errors).toEqual([]);
});

// Each runs under the real policy, so a decoder Worker that Trusted Types
// refused (see src/lib/trusted-types.ts) fails here as a console error.
for (const [name, how] of [
	['floor.draco.glb', 'Draco'],
	['floor.meshopt.glb', 'Meshopt']
]) {
	test(`a ${how}-compressed glTF opens, with its camera`, async ({ page }) => {
		const errors = collectErrors(page);
		await ready(page);
		await page.getByLabel('Open model…').setInputFiles(fixture(name));
		await expectModel(page, name);
		await expect(page.getByRole('button', { name: 'Doorway', exact: true })).toBeVisible();
		expect(errors).toEqual([]);
	});
}

test('an OBJ opens with the materials its .mtl names, and lists the missing texture', async ({
	page
}) => {
	const errors = collectErrors(page);
	await ready(page);
	await page.getByLabel('Open model…').setInputFiles([fixture('floor.obj'), fixture('floor.mtl')]);
	await expectModel(page, 'floor.obj');
	await expect(page.getByRole('status')).toContainText('tile.jpg');
	expect(errors).toEqual([]);
});

// Sixty identical blocks, each its own mesh: dedup finds one, instance draws
// it once. The camera has to survive the round trip, and nothing may log an
// error — GLTFExporter, glTF-Transform and GLTFLoader all run here.
test('a model with many meshes is optimised, cameras kept', async ({ page }) => {
	const errors = collectErrors(page);
	await ready(page);
	await page.getByLabel('Open model…').setInputFiles(fixture('blocks.glb'));
	await expectModel(page, 'blocks.glb');
	await expect(page.getByText('Optimised for VR: 60 meshes drawn as 1.')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Overlook', exact: true })).toBeVisible();
	expect(errors).toEqual([]);
});

test('optimising can be switched off, and stays off', async ({ page }) => {
	await ready(page);
	await page.getByRole('switch', { name: 'Optimise large models' }).uncheck();
	await reloaded(page);
	await expect(page.getByRole('switch', { name: 'Optimise large models' })).not.toBeChecked();
	await page.getByLabel('Open model…').setInputFiles(fixture('blocks.glb'));
	await expectModel(page, 'blocks.glb');
	await expect(page.getByText('Optimised for VR')).toHaveCount(0);
});

// A Gaussian splat scan, through Spark: decoded in a blob: Worker under the
// real Trusted Types policy, and raycastable, so a note can be pinned to it.
test('a splat scan opens, and takes a note', async ({ page }) => {
	const errors = collectErrors(page);
	await ready(page);
	await page.getByLabel('Open model…').setInputFiles(fixture('scan.splat'));
	await expectModel(page, 'scan.splat');
	await page.getByRole('button', { name: 'Add note' }).click();
	const box = (await page.locator('.viewport canvas').boundingBox())!;
	await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
	await expect(page.locator('.note-text')).toHaveCount(1);
	expect(errors).toEqual([]);
});

test('a .ply that is a mesh, not a scan, opens as a mesh', async ({ page }) => {
	const errors = collectErrors(page);
	await ready(page);
	await page.getByLabel('Open model…').setInputFiles(fixture('box.ply'));
	await expectModel(page, 'box.ply');
	expect(errors).toEqual([]);
});

test('a SketchUp-style COLLADA file opens, scene cameras named, missing texture listed', async ({
	page
}) => {
	const errors = collectErrors(page);
	await ready(page);
	await page.getByLabel('Open model…').setInputFiles(fixture('floor.dae'));
	await expectModel(page, 'floor.dae');
	await expect(page.getByRole('button', { name: 'Front Door', exact: true })).toBeVisible();
	await expect(page.getByRole('status')).toContainText('tile.jpg');
	// ColladaLoader warns about Z-up on purpose; warnings aren't errors.
	expect(errors).toEqual([]);
});

test('a texture picked with the model is used, not reported missing', async ({ page }) => {
	await ready(page);
	await page.getByLabel('Open model…').setInputFiles([
		{
			name: 'floor.dae',
			mimeType: 'model/vnd.collada+xml',
			buffer: readFileSync(fixture('floor.dae'))
		},
		{
			name: 'tile.jpg',
			mimeType: 'image/png',
			// One grey pixel: the name is what's being matched, not the format.
			buffer: Buffer.from(
				'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNoAAAAggCBd81ytgAAAABJRU5ErkJggg==',
				'base64'
			)
		}
	]);
	await expectModel(page, 'floor.dae');
	await expect(page.getByText('Shown without')).toHaveCount(0);
});

test('a model reopens from the last session without the file picker', async ({ page }) => {
	await ready(page);
	await page.getByLabel('Open model…').setInputFiles(fixture('floor.gltf'));
	await expectModel(page, 'floor.gltf');
	await reloaded(page);
	await page.getByRole('button', { name: 'Reopen floor.gltf' }).click();
	await expectModel(page, 'floor.gltf');
});

// An `accept` list greys .glb and .dae out in Android-based file pickers,
// the Quest's included: they have no MIME type those pickers know.
test('the model picker filters nothing, so the headset can pick any file', async ({ page }) => {
	await ready(page);
	await expect(page.getByLabel('Open model…')).not.toHaveAttribute('accept');
});

test('a SketchUp file is refused with how to export it', async ({ page }) => {
	await ready(page);
	await page.getByLabel('Open model…').setInputFiles({
		name: 'house.skp',
		mimeType: 'application/octet-stream',
		buffer: Buffer.from('not really')
	});
	await expect(page.getByRole('alert')).toContainText('COLLADA (.dae)', { timeout: 20_000 });
	await expectModel(page, 'Sample pavilion');
});
