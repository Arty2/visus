import { expect, test } from '@playwright/test';

/*
 * visus is dark whatever the system asks for (see src/app.css). Asserted in
 * both schemes, with the computed values, because the failure this guards
 * against is silent: a token that doesn't resolve leaves `color` and
 * `background` at nothing, and the page renders unreadable without a single
 * error. osseus learned that from `light-dark()`; the check outlived it.
 */
for (const colorScheme of ['light', 'dark'] as const) {
	test(`the page is dark when the system asks for ${colorScheme}`, async ({ page }) => {
		await page.emulateMedia({ colorScheme });
		await page.goto('/');
		await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(7, 9, 12)');
		await expect(page.locator('body')).toHaveCSS('color', 'rgb(232, 238, 245)');
	});
}
