import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { collectErrors, ready, reloaded } from './helpers';

// Sketching on a screen: drag on the model with a tool in hand. Positions
// are fractions of the canvas, looking from the sample's Approach camera,
// where the lower middle of the view is the pavilion's plinth and lawn.

async function drag(page: Page, from: [number, number], to: [number, number], steps = 10) {
	const box = (await page.locator('.viewport canvas').boundingBox())!;
	const at = ([x, y]: [number, number]) => [box.x + box.width * x, box.y + box.height * y] as const;
	await page.mouse.move(...at(from));
	await page.mouse.down();
	for (let i = 1; i <= steps; i++) {
		const t = i / steps;
		await page.mouse.move(
			...at([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t])
		);
	}
	await page.mouse.up();
}

async function approach(page: Page) {
	await ready(page);
	await page.getByRole('button', { name: 'Approach' }).click();
}

const count = (page: Page) => page.locator('.sketch-row span');

test('a rectangle drawn on the model is kept, exported, and survives a reload', async ({
	page
}) => {
	const errors = collectErrors(page);
	await approach(page);
	await page.getByRole('radio', { name: 'Rectangle' }).click();
	await drag(page, [0.35, 0.62], [0.55, 0.7]);
	await expect(count(page)).toHaveText('1 sketch');

	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export JSON' }).click()
	]);
	const [sketch] = JSON.parse(readFileSync((await download.path())!, 'utf8')).sketches;
	expect(sketch.kind).toBe('rect');
	expect(sketch.points).toHaveLength(5); // four corners, closed
	expect(sketch.colour).toBe('#fa4d56');

	await reloaded(page);
	await expect(count(page)).toHaveText('1 sketch');
	expect(errors).toEqual([]);
});

test('a click is not a mark, and choosing the tool again puts it down', async ({ page }) => {
	await approach(page);
	const pen = page.getByRole('radio', { name: 'Pen' });
	await pen.click();
	await drag(page, [0.5, 0.65], [0.5, 0.65], 1);
	await expect(count(page)).toHaveText('0 sketches');
	await pen.click();
	await expect(pen).not.toBeChecked();
});

test('the eraser takes a sketch away, and undo brings it back', async ({ page }) => {
	await approach(page);
	await page.getByRole('radio', { name: 'Line' }).click();
	await drag(page, [0.3, 0.68], [0.6, 0.68]);
	await expect(count(page)).toHaveText('1 sketch');

	await page.getByRole('radio', { name: 'Eraser' }).click();
	await drag(page, [0.45, 0.68], [0.45, 0.68], 1);
	await expect(count(page)).toHaveText('0 sketches');

	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(count(page)).toHaveText('1 sketch');
});

test('clearing every sketch is one step to undo', async ({ page }) => {
	await approach(page);
	await page.getByRole('radio', { name: 'Arrow' }).click();
	await drag(page, [0.3, 0.75], [0.45, 0.65]);
	await page.getByRole('radio', { name: 'Green' }).click();
	await drag(page, [0.55, 0.75], [0.7, 0.65]);
	await expect(count(page)).toHaveText('2 sketches');

	await page.getByRole('button', { name: 'Clear sketches' }).click();
	await expect(count(page)).toHaveText('0 sketches');
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(count(page)).toHaveText('2 sketches');
});
