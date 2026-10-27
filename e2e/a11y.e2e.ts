import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the starter page has no automatically detectable a11y violations', async ({ page }) => {
	await page.goto('/');
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});

test('the what-changed dialog has no automatically detectable a11y violations', async ({
	page
}) => {
	await page.goto('/');
	await page.getByRole('button', { name: /^v\d/ }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
});
