import { expect, test } from '@playwright/test';

/*
 * The failure path nothing else exercises: a browser that refuses to write.
 * A private window, blocked site data and a full quota all surface the same
 * way — `localStorage.setItem` throws — and an app that swallows that looks
 * exactly like one that saved, right up until the reload that loses
 * everything. Stubbed here rather than waited for, because there is no way
 * to fill a real quota quickly and no reason to.
 */
test('a browser that refuses to save says so, and the list still works', async ({ page }) => {
	await page.addInitScript(() => {
		// Patched on the prototype, not on the instance: `Storage` intercepts
		// own-property definition and would quietly file `setItem` as a stored
		// *key* instead of shadowing the method, leaving the stub inert.
		Object.defineProperty(Storage.prototype, 'setItem', {
			configurable: true,
			value: () => {
				throw new DOMException('exceeded the quota', 'QuotaExceededError');
			}
		});
	});

	await page.goto('/');
	await page.getByLabel('New item').fill('will not persist');
	await page.getByLabel('New item').press('Enter');

	// Added in memory — the tab is still usable, which is the point of
	// reporting rather than throwing...
	await expect(page.getByRole('listitem').filter({ hasText: 'will not persist' })).toBeVisible();
	// ...and the page says plainly that it won't survive a reload.
	await expect(page.getByRole('alert')).toContainText('refused to save');
});
