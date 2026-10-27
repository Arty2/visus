import { expect, test } from '@playwright/test';

/*
 * The theming decision this guards: both tokens resolve from
 * `prefers-color-scheme` alone, with no script involved and nothing to flash.
 *
 * It exists because the first version of src/app.css used `light-dark()`,
 * which is Baseline Newly available rather than Widely available — and its
 * failure mode is invisible in a supporting browser and catastrophic in a
 * non-supporting one: the whole custom-property declaration is invalid at
 * computed-value time, so `color` and `background` resolve to nothing and a
 * dark-scheme browser paints black on black. Asserting the computed values in
 * both schemes is what makes the fix load-bearing rather than a comment.
 */
test('the light scheme paints ink on paper', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('/');
	await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
	await expect(page.locator('body')).toHaveCSS('color', 'rgb(0, 0, 0)');
});

test('the dark scheme swaps which of the two is the paper', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(0, 0, 0)');
	await expect(page.locator('body')).toHaveCSS('color', 'rgb(255, 255, 255)');
});
