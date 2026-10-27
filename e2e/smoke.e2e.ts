import { expect, test } from '@playwright/test';
import pkg from '../package.json' with { type: 'json' };

test('the starter page renders and the version credit matches package.json', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveTitle('osseus');
	await expect(page.locator('.credit')).toHaveText(`v${pkg.version}`);
});

test('adding and ticking an item persists across a reload', async ({ page }) => {
	await page.goto('/');
	const draft = page.getByLabel('New item');
	await draft.fill('write the README');
	await draft.press('Enter');

	const row = page.getByRole('listitem').filter({ hasText: 'write the README' });
	await expect(row).toBeVisible();

	await row.getByRole('checkbox').check();
	await expect(row.locator('.done')).toHaveText('write the README');

	await page.reload();
	const reloadedRow = page.getByRole('listitem').filter({ hasText: 'write the README' });
	await expect(reloadedRow.getByRole('checkbox')).toBeChecked();
});

test('removing an item takes it off the list, and undo puts it back', async ({ page }) => {
	await page.goto('/');
	const draft = page.getByLabel('New item');
	await draft.fill('temporary');
	await draft.press('Enter');

	const row = page.getByRole('listitem').filter({ hasText: 'temporary' });
	await row.getByRole('button', { name: /remove/i }).click();
	await expect(row).toHaveCount(0);

	await expect(page.getByRole('status')).toContainText('Deleted');
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(page.getByRole('listitem').filter({ hasText: 'temporary' })).toBeVisible();

	// The offer is spent once taken, and the restored list survives a reload —
	// undo writes through to storage like any other change.
	await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
	await page.reload();
	await expect(page.getByRole('listitem').filter({ hasText: 'temporary' })).toBeVisible();
});

test('export downloads a JSON file that round-trips through import', async ({ page }) => {
	await page.goto('/');
	await page.getByLabel('New item').fill('exported item');
	await page.getByLabel('New item').press('Enter');

	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export JSON' }).click()
	]);
	expect(download.suggestedFilename()).toBe('items.json');

	const path = await download.path();
	expect(path).toBeTruthy();

	await page.getByLabel('Import').setInputFiles(path!);
	await expect(page.getByRole('listitem').filter({ hasText: 'exported item' })).toBeVisible();
});

test('importing a malformed file shows an error instead of clearing the list', async ({ page }) => {
	await page.goto('/');
	await page.getByLabel('New item').fill('keep me');
	await page.getByLabel('New item').press('Enter');

	await page.getByLabel('Import').setInputFiles({
		name: 'bad.json',
		mimeType: 'application/json',
		buffer: Buffer.from('{"not":"a list"}')
	});

	await expect(page.getByRole('alert')).toContainText('not a recognised item list');
	await expect(page.getByRole('listitem').filter({ hasText: 'keep me' })).toBeVisible();
});

// The regression this exists for: fromMarkdown reads prose as zero items, and
// an earlier version applied that, so importing a README emptied the list
// with nothing said and no way back.
test('importing prose with no list in it is refused, not applied', async ({ page }) => {
	await page.goto('/');
	await page.getByLabel('New item').fill('keep me too');
	await page.getByLabel('New item').press('Enter');

	await page.getByLabel('Import').setInputFiles({
		name: 'README.md',
		mimeType: 'text/markdown',
		buffer: Buffer.from('# Readme\n\nJust prose. No list here at all.\n')
	});

	await expect(page.getByRole('alert')).toContainText('contains no items');
	await expect(page.getByRole('listitem').filter({ hasText: 'keep me too' })).toBeVisible();
});

test('an import is undoable, because it replaces everything', async ({ page }) => {
	await page.goto('/');
	await page.getByLabel('New item').fill('the original list');
	await page.getByLabel('New item').press('Enter');

	await page.getByLabel('Import').setInputFiles({
		name: 'other.md',
		mimeType: 'text/markdown',
		buffer: Buffer.from('- [ ] something else entirely\n')
	});

	await expect(
		page.getByRole('listitem').filter({ hasText: 'something else entirely' })
	).toBeVisible();
	await expect(page.getByRole('listitem').filter({ hasText: 'the original list' })).toHaveCount(0);

	await expect(page.getByRole('status')).toContainText('Imported 1 item');
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(page.getByRole('listitem').filter({ hasText: 'the original list' })).toBeVisible();
});

test('the version opens what changed in it', async ({ page }) => {
	await page.goto('/');
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeHidden();

	await page.getByRole('button', { name: `v${pkg.version}` }).click();
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('heading')).toHaveText(`What's new in ${pkg.version}`);
	await expect(dialog.getByRole('listitem').first()).not.toBeEmpty();

	await dialog.getByRole('button', { name: 'Close' }).click();
	await expect(dialog).toBeHidden();
});

// A first run stays closed (the page is its own introduction); a version
// someone hasn't seen yet opens on its own, once.
test('what changed opens by itself after an update, and only once', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('dialog')).toBeHidden();

	await page.evaluate(() => localStorage.setItem('osseus:seen-version', '0.0.1'));
	await page.reload();
	await expect(page.getByRole('dialog')).toBeVisible();

	await page.keyboard.press('Escape');
	await page.reload();
	await expect(page.getByRole('dialog')).toBeHidden();
});
