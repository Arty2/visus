import { expect, test } from '@playwright/test';
import { placeNote, ready } from './helpers';

/*
 * The failure path nothing else exercises: a browser that refuses to write.
 * A private window, blocked site data and a full quota all surface the same
 * way — `localStorage.setItem` throws — and an app that swallows that looks
 * exactly like one that saved, right up until the reload that loses
 * everything. Stubbed rather than waited for.
 */
test('a browser that refuses to save says so, and notes still work', async ({ page }) => {
	await page.addInitScript(() => {
		// On the prototype: `Storage` files an own `setItem` as a stored key.
		Object.defineProperty(Storage.prototype, 'setItem', {
			configurable: true,
			value: () => {
				throw new DOMException('exceeded the quota', 'QuotaExceededError');
			}
		});
	});

	await ready(page);
	await placeNote(page, 'will not persist');
	await expect(page.locator('.note-text')).toHaveValue('will not persist');
	await expect(page.getByRole('alert')).toContainText('refused to save');
});
