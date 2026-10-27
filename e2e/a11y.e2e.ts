import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { placeNote, ready } from './helpers';

test('the page, with a note and a saved view, has no automatically detectable a11y violations', async ({
	page
}) => {
	await ready(page);
	await placeNote(page, 'accessible');
	await page.getByRole('button', { name: 'Save this view' }).click();
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});

test('the controls dialog has no automatically detectable a11y violations', async ({ page }) => {
	await ready(page);
	await page.getByRole('button', { name: 'Controls' }).click();
	await expect(page.getByRole('dialog', { name: 'Controls' })).toBeVisible();
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});

test('the what-changed dialog has no automatically detectable a11y violations', async ({
	page
}) => {
	await ready(page);
	await page.getByRole('button', { name: /^v\d/ }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});
