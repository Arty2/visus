import { expect, test } from '@playwright/test';
import { collectErrors, ready } from './helpers';

test('the app can be installed: a manifest with icons', async ({ page, request }) => {
	await ready(page);
	const href = await page.locator('link[rel="manifest"]').getAttribute('href');
	expect(href).toBeTruthy();
	const manifest = await (await request.get(new URL(href!, page.url()).href)).json();
	expect(manifest.name).toBe('visus');
	expect(manifest.display).toBe('standalone');
	const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
	expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
	for (const icon of manifest.icons) {
		const res = await request.get(new URL(icon.src, page.url()).href);
		expect(res.ok(), icon.src).toBe(true);
	}
});

test('once visited, the app opens offline', async ({ page, context }) => {
	const errors = collectErrors(page);
	await ready(page);
	// The worker has cached the app once it is active and controls the page.
	await page.evaluate(async () => {
		await navigator.serviceWorker.ready;
		if (!navigator.serviceWorker.controller) {
			await new Promise((r) =>
				navigator.serviceWorker.addEventListener('controllerchange', r, { once: true })
			);
		}
	});
	await context.setOffline(true);
	try {
		await page.reload();
		await expect(page.getByRole('button', { name: 'Approach' })).toBeVisible({ timeout: 30_000 });
	} finally {
		await context.setOffline(false);
	}
	// Offline reloads may log the network being down; nothing else.
	expect(errors.filter((e) => !/ERR_INTERNET_DISCONNECTED/.test(e))).toEqual([]);
});
