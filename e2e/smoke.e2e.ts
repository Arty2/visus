import { expect, test } from '@playwright/test';
import pkg from '../package.json' with { type: 'json' };
import { placeNote, ready } from './helpers';

test('the page renders and the version credit matches package.json', async ({ page }) => {
	await ready(page);
	await expect(page).toHaveTitle('visus');
	await expect(page.locator('.credit')).toHaveText(`v${pkg.version}`);
	await expect(page.getByRole('heading', { name: 'Sample pavilion' })).toBeVisible();
});

test('the sample opens with the cameras it carries, and a view can be looked from', async ({
	page
}) => {
	await ready(page);
	for (const name of ['Approach', 'Under the roof', 'Bench']) {
		await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
	}
	await page.getByRole('button', { name: 'Bench' }).click();
	await expect(page.getByRole('button', { name: 'Bench' })).toHaveAttribute('aria-current', 'true');
});

test('a note placed on the model persists across a reload', async ({ page }) => {
	await ready(page);
	await placeNote(page, 'Check the step height');
	await page.reload();
	await expect(page.locator('.note-text')).toHaveValue('Check the step height');
});

test('resolving and deleting a note, and undo putting it back', async ({ page }) => {
	await ready(page);
	await placeNote(page, 'temporary');
	await page.getByRole('checkbox', { name: /Resolved/ }).check();
	await expect(page.locator('.note-text.done')).toHaveValue('temporary');

	await page.getByRole('button', { name: 'Delete note 1' }).click();
	await expect(page.locator('.note-text')).toHaveCount(0);
	await expect(page.getByRole('status')).toContainText('Deleted “temporary”');
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(page.locator('.note-text')).toHaveValue('temporary');

	await page.reload();
	await expect(page.locator('.note-text')).toHaveValue('temporary');
});

test('a saved view joins the list, can be renamed, and survives a reload', async ({ page }) => {
	await ready(page);
	await page.getByRole('button', { name: 'Save this view' }).click();
	await expect(page.getByRole('button', { name: 'View 1', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Rename View 1' }).click();
	const field = page.getByLabel('New name for View 1');
	await expect(field).toBeFocused();
	await field.fill('From the lawn');
	await field.press('Enter');
	await expect(page.getByRole('button', { name: 'From the lawn', exact: true })).toBeVisible();

	// Escape leaves the name as it was.
	await page.getByRole('button', { name: 'Rename From the lawn' }).click();
	await page.getByLabel('New name for From the lawn').fill('discarded');
	await page.getByLabel('New name for From the lawn').press('Escape');
	await page.reload();
	await expect(page.getByRole('button', { name: 'From the lawn', exact: true })).toBeVisible();
});

test('notes export as JSON and Markdown, and each round-trips through import', async ({ page }) => {
	await ready(page);
	await placeNote(page, 'exported note');

	for (const [button, name] of [
		['Export JSON', 'Sample pavilion.notes.json'],
		['Export Markdown', 'Sample pavilion.notes.md']
	]) {
		const [download] = await Promise.all([
			page.waitForEvent('download'),
			page.getByRole('button', { name: button }).click()
		]);
		expect(download.suggestedFilename()).toBe(name);
		const path = (await download.path())!;

		await page.getByRole('button', { name: 'Delete note 1' }).click();
		await expect(page.locator('.note-text')).toHaveCount(0);
		await page.getByLabel('Import notes').setInputFiles(path);
		await expect(page.locator('.note-text')).toHaveValue('exported note');
	}
});

test('importing a malformed file shows an error and keeps the notes', async ({ page }) => {
	await ready(page);
	await placeNote(page, 'keep me');
	await page.getByLabel('Import notes').setInputFiles({
		name: 'bad.json',
		mimeType: 'application/json',
		buffer: Buffer.from('{"annotations":"nope"}')
	});
	await expect(page.getByRole('alert')).toContainText('not a recognised set of notes');
	await expect(page.locator('.note-text')).toHaveValue('keep me');
});

// fromMarkdown reads prose as nothing; applying that would empty the notes.
test('importing prose with no notes in it is refused, not applied', async ({ page }) => {
	await ready(page);
	await placeNote(page, 'keep me too');
	await page.getByLabel('Import notes').setInputFiles({
		name: 'README.md',
		mimeType: 'text/markdown',
		buffer: Buffer.from('# Readme\n\n- [ ] a to-do with nowhere to pin it\n')
	});
	await expect(page.getByRole('alert')).toContainText('contains no notes');
	await expect(page.locator('.note-text')).toHaveValue('keep me too');
});

test('an import is undoable, because it replaces every note', async ({ page }) => {
	await ready(page);
	await placeNote(page, 'the original');
	await page.getByLabel('Import notes').setInputFiles({
		name: 'other.md',
		mimeType: 'text/markdown',
		buffer: Buffer.from('- [ ] something else entirely @ 0, 0.5, 0\n')
	});
	await expect(page.locator('.note-text')).toHaveValue('something else entirely');
	await expect(page.getByRole('status')).toContainText('Imported 1');
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(page.locator('.note-text')).toHaveValue('the original');
});

test('the version opens what changed in it', async ({ page }) => {
	await ready(page);
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeHidden();

	await page.getByRole('button', { name: `v${pkg.version}` }).click();
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('heading')).toHaveText(`What's new in ${pkg.version}`);
	await expect(dialog.getByRole('listitem').first()).not.toBeEmpty();

	await dialog.getByRole('button', { name: 'Close' }).click();
	await expect(dialog).toBeHidden();
});

test('what changed opens by itself after an update, and only once', async ({ page }) => {
	await ready(page);
	await expect(page.getByRole('dialog')).toBeHidden();

	await page.evaluate(() => localStorage.setItem('visus:seen-version', '0.0.1'));
	await page.reload();
	await expect(page.getByRole('dialog')).toBeVisible();

	await page.keyboard.press('Escape');
	await page.reload();
	await expect(page.getByRole('dialog')).toBeHidden();
});
