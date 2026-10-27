import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectErrors, ready } from './helpers';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

// Both loaders run under the full Content Security Policy here, which is the
// point: a .gltf with embedded buffers is fetched from data: URIs, and a .dae
// is parsed through a blob: URL because DOMParser is a Trusted Types sink.
// Either path breaking shows up as a console error, not as a failed request.

test('a glTF opens, with the camera it carries', async ({ page }) => {
	const errors = collectErrors(page);
	await ready(page);
	await page.getByLabel('Open model…').setInputFiles(fixture('floor.gltf'));
	await expect(page.getByRole('heading', { name: 'floor.gltf' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Doorway', exact: true })).toBeVisible();
	expect(errors).toEqual([]);
});

test('a SketchUp-style COLLADA file opens, scene cameras named, missing texture listed', async ({
	page
}) => {
	const errors = collectErrors(page);
	await ready(page);
	await page.getByLabel('Open model…').setInputFiles(fixture('floor.dae'));
	await expect(page.getByRole('heading', { name: 'floor.dae' })).toBeVisible();
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
	await expect(page.getByRole('heading', { name: 'floor.dae' })).toBeVisible();
	await expect(page.getByText('Shown without')).toHaveCount(0);
});

test('a model reopens from the last session without the file picker', async ({ page }) => {
	await ready(page);
	await page.getByLabel('Open model…').setInputFiles(fixture('floor.gltf'));
	await expect(page.getByRole('heading', { name: 'floor.gltf' })).toBeVisible();
	await page.reload();
	await page.getByRole('button', { name: 'Reopen floor.gltf' }).click();
	await expect(page.getByRole('heading', { name: 'floor.gltf' })).toBeVisible();
});

test('a SketchUp file is refused with how to export it', async ({ page }) => {
	await ready(page);
	await page.getByLabel('Open model…').setInputFiles({
		name: 'house.skp',
		mimeType: 'application/octet-stream',
		buffer: Buffer.from('not really')
	});
	await expect(page.getByRole('alert')).toContainText('COLLADA (.dae)');
	await expect(page.getByRole('heading', { name: 'Sample pavilion' })).toBeVisible();
});
