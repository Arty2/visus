import { expect, type Page } from '@playwright/test';

/** The page with the viewer up and the sample open — its views listed. */
export async function ready(page: Page) {
	await page.goto('/');
	// Generous: in CI the canvas is drawn by a software renderer, and three.js
	// arrives after the page itself.
	await expect(page.getByRole('button', { name: 'Approach' })).toBeVisible({ timeout: 30_000 });
}

/**
 * Places a note the way a person would on a screen: look from the
 * Approach camera, press Add note, click the middle of the pavilion.
 */
export async function placeNote(page: Page, text: string) {
	await page.getByRole('button', { name: 'Approach' }).click();
	await page.getByRole('button', { name: 'Add note' }).click();
	const box = (await page.locator('.viewport canvas').boundingBox())!;
	const before = await page.locator('.note-text').count();
	await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
	await expect(page.locator('.note-text')).toHaveCount(before + 1);
	const field = page.locator('.note-text').last();
	await expect(field).toBeFocused();
	await field.fill(text);
	await field.press('Enter');
}

/** Console errors and uncaught exceptions — CSP violations land here. */
export function collectErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(msg.text());
	});
	page.on('pageerror', (err) => errors.push(String(err)));
	return errors;
}

/**
 * Waits for a model to be the one shown. Opening is real work — parsing,
 * then a first frame from a software renderer — and under a full parallel
 * run it outlasts the default five seconds now and then.
 */
export async function expectModel(page: Page, name: string) {
	await expect(page.locator('.chip-title')).toHaveText(name, { timeout: 20_000 });
}
