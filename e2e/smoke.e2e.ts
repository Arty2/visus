import { expect, test } from '@playwright/test';
import pkg from '../package.json' with { type: 'json' };
import { expectModel, placeNote, ready } from './helpers';

test('the page renders and the version credit matches package.json', async ({ page }) => {
	await ready(page);
	await expect(page).toHaveTitle('visus');
	await expect(page.locator('.credit')).toHaveText(`v${pkg.version}`);
	await expectModel(page, 'Sample pavilion');
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

test('the background is white unless chosen, and a choice is remembered', async ({ page }) => {
	await ready(page);
	// One of four, so radios: Bits UI's single-choice toggle group.
	await expect(page.getByRole('radio', { name: 'White background' })).toBeChecked();
	await page.getByRole('radio', { name: 'Sky background' }).click();
	await page.reload();
	await expect(page.getByRole('radio', { name: 'Sky background' })).toBeChecked();
	await expect(page.getByRole('radio', { name: 'White background' })).not.toBeChecked();
});

test('icon buttons say what they do on hover', async ({ page }) => {
	await ready(page);
	await page.getByRole('radio', { name: 'Night background' }).hover();
	await expect(page.getByText('Night', { exact: true })).toBeVisible();
});

// Icons drawn in the browser once came out as HTML-namespaced <path>s, which
// draw nothing — invisible, with no error anywhere. See Icon.svelte.
test('every icon is real SVG, including ones drawn after load', async ({ page }) => {
	await ready(page);
	await page.getByRole('button', { name: 'Approach' }).click();
	await page.getByRole('button', { name: 'Add note' }).click();
	const namespaces = await page
		.locator('svg path')
		.evaluateAll((paths) => [...new Set(paths.map((p) => p.namespaceURI))]);
	expect(namespaces).toEqual(['http://www.w3.org/2000/svg']);
});

test('a note placed on the model persists across a reload', async ({ page }) => {
	await ready(page);
	await placeNote(page, 'Check the step height');
	await page.reload();
	await expect(page.locator('.note-text')).toHaveValue('Check the step height');
});

test('Escape leaves note-placing mode', async ({ page }) => {
	await ready(page);
	const add = page.getByRole('button', { name: 'Add note' });
	await add.click();
	await expect(add).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('status')).toContainText('Click the model to place a note');
	await page.keyboard.press('Escape');
	await expect(add).toHaveAttribute('aria-pressed', 'false');
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

// A hand-edited file can repeat an id; the lists are keyed by id, and a
// repeat once stopped the page drawing them at all — and was saved, so it
// stayed broken across reloads.
test('importing notes that share an id shows all of them', async ({ page }) => {
	await ready(page);
	const note = (text: string) => ({ id: 'same', text, done: false, position: [0, 0.5, 0] });
	await page.getByLabel('Import notes').setInputFiles({
		name: 'repeated.json',
		mimeType: 'application/json',
		buffer: Buffer.from(
			JSON.stringify({ version: 1, annotations: [note('first'), note('second')], viewpoints: [] })
		)
	});
	await expect(page.locator('.note-text')).toHaveCount(2);
	await page.reload();
	await expect(page.locator('.note-text')).toHaveCount(2);
});

test('the current view stays marked when a view above it is deleted', async ({ page }) => {
	await ready(page);
	await page.getByRole('button', { name: 'Save this view' }).click();
	await page.getByRole('button', { name: 'Save this view' }).click();
	await page.getByRole('button', { name: 'View 2', exact: true }).click();
	await page.getByRole('button', { name: 'Delete View 1' }).click();
	await expect(page.locator('[aria-current="true"]')).toHaveText('View 2');
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

test('an import merges with the notes already here, and is undoable', async ({ page }) => {
	await ready(page);
	await placeNote(page, 'the original');
	await page.getByLabel('Import notes').setInputFiles({
		name: 'other.md',
		mimeType: 'text/markdown',
		buffer: Buffer.from('- [ ] something else entirely @ 0, 0.5, 0\n')
	});
	await expect(page.locator('.note-text')).toHaveCount(2);
	await expect(page.locator('.note-text').nth(1)).toHaveValue('something else entirely');
	await expect(page.getByRole('status')).toContainText('Merged in “other.md”');

	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(page.locator('.note-text')).toHaveCount(1);
	await expect(page.locator('.note-text')).toHaveValue('the original');
});

// Two people, two browsers: what one exports, the other merges in, and
// neither loses anything.
test('a colleague’s export merges with your own notes', async ({ browser }) => {
	const theirs = await browser.newPage();
	await ready(theirs);
	await placeNote(theirs, 'from them');
	const [download] = await Promise.all([
		theirs.waitForEvent('download'),
		theirs.getByRole('button', { name: 'Export JSON' }).click()
	]);
	const file = (await download.path())!;

	const mine = await browser.newPage();
	await ready(mine);
	await placeNote(mine, 'from me');
	await mine.getByLabel('Import notes').setInputFiles(file);
	await expect(mine.locator('.note-text')).toHaveCount(2);
	const texts = await mine
		.locator('.note-text')
		.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value).sort());
	expect(texts).toEqual(['from me', 'from them']);
});

test('re-importing a Markdown export does not double the notes', async ({ page }) => {
	await ready(page);
	await placeNote(page, 'only once');
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export Markdown' }).click()
	]);
	await page.getByLabel('Import notes').setInputFiles((await download.path())!);
	await expect(page.getByRole('status')).toContainText('Merged in');
	await expect(page.locator('.note-text')).toHaveCount(1);
});

test('Ctrl+Z steps back through changes, and Shift+Ctrl+Z forward', async ({ page }) => {
	await ready(page);
	await placeNote(page, 'first');
	await page.getByRole('button', { name: 'Save this view' }).click();
	await expect(page.getByRole('button', { name: 'View 1', exact: true })).toBeVisible();

	await page.locator('body').click({ position: { x: 5, y: 5 } }); // out of the text field
	await page.keyboard.press('Control+z');
	await expect(page.getByRole('button', { name: 'View 1', exact: true })).toHaveCount(0);
	await page.keyboard.press('Control+Shift+z');
	await expect(page.getByRole('button', { name: 'View 1', exact: true })).toBeVisible();
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
	// Three full page loads, each starting the viewer on a software renderer:
	// under a full parallel run that alone can pass the usual minute.
	test.setTimeout(120_000);
	await ready(page);
	await expect(page.getByRole('dialog')).toBeHidden();

	await page.evaluate(() => localStorage.setItem('visus:seen-version', '0.0.1'));
	await page.reload();
	await expect(page.getByRole('dialog')).toBeVisible();

	await page.keyboard.press('Escape');
	await page.reload();
	await expect(page.getByRole('dialog')).toBeHidden();
});
