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

// Notes saved before 0.2 are plain lists; from 0.2 storage holds a Yjs
// document. Old notes must come through the change untouched.
test('notes saved by an earlier version still appear', async ({ page }) => {
	await page.addInitScript(() => {
		if (localStorage.getItem('visus:notes:sample')) return; // only the first load
		localStorage.setItem(
			'visus:notes:sample',
			JSON.stringify({
				version: 1,
				annotations: [
					{ id: 'old-1', text: 'left in 0.1', done: false, position: [0, 0.5, 0] },
					{ id: 'old-2', text: 'and resolved', done: true, position: [1, 0.5, 0] }
				],
				viewpoints: [{ id: 'old-v', name: 'Old view', position: [0, 1.6, 8], yaw: 0 }]
			})
		);
	});
	await ready(page);
	await expect(page.locator('.note-text')).toHaveCount(2);
	await expect(page.locator('.note-text').first()).toHaveValue('left in 0.1');
	await expect(page.getByRole('checkbox', { name: 'Resolved: note 2' })).toBeChecked();
	await expect(page.getByRole('button', { name: 'Old view', exact: true })).toBeVisible();
});
