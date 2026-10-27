import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { collectErrors, ready } from './helpers';
import { loadDoc, readNotes } from '../src/lib/store/doc';

/*
 * The headset half, driven through Meta's Immersive Web Emulation Runtime
 * (IWER): an emulated Quest 3 with Touch Plus controllers, installed over
 * whatever navigator.xr the browser has, before the page's own scripts run.
 * It's a devDependency and is injected only here — nothing of it ships.
 *
 * What this can show: a session starts under the real CSP, every control is
 * wired to the right button, and none of it throws. What it can't: comfort,
 * frame rate, or how anything looks through the lenses — that takes a
 * headset.
 */

const iwer = createRequire(import.meta.url).resolve('iwer/build/iwer.min.js');

type Hand = 'left' | 'right';

async function enterVR(page: Page) {
	await page.addInitScript({ path: iwer });
	await page.addInitScript(() => {
		const xr = (globalThis as unknown as { IWER: Record<string, unknown> }).IWER;
		const Device = xr.XRDevice as new (config: unknown) => {
			installRuntime(o: object): void;
		};
		const device = new Device(xr.metaQuest3);
		device.installRuntime({ forceInstall: true });
		(globalThis as unknown as { __xr: unknown }).__xr = device;
	});
	await ready(page);
	await page.getByRole('button', { name: 'Enter VR' }).click();
	await expect(page.getByText('In VR — take the headset off')).toBeVisible();
	// The opening placement waits for the first head pose.
	await page.waitForTimeout(500);
}

// Waits for real animation frames, not a fixed time: IWER drives the XR
// session's frames from them, so a button held across `n` of these has been
// seen by at least `n - 1` of the app's frames, however slowly a software
// renderer draws. A fixed delay passed on a quiet machine and missed presses
// on a busy one.
async function frames(page: Page, n = 3) {
	await page.evaluate(
		(count) =>
			new Promise<void>((resolve) => {
				let left = count;
				const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
				requestAnimationFrame(tick);
			}),
		n
	);
}

async function press(page: Page, hand: Hand, button: string) {
	await page.evaluate(
		([h, b]) => (globalThis as any).__xr.controllers[h].updateButtonValue(b, 1), // eslint-disable-line @typescript-eslint/no-explicit-any
		[hand, button]
	);
	await frames(page);
	await page.evaluate(
		([h, b]) => (globalThis as any).__xr.controllers[h].updateButtonValue(b, 0), // eslint-disable-line @typescript-eslint/no-explicit-any
		[hand, button]
	);
	await frames(page);
}

test('A and B step through the model’s cameras, in step with the page', async ({ page }) => {
	const errors = collectErrors(page);
	await enterVR(page);
	const current = page.locator('[aria-current="true"]');

	await press(page, 'right', 'a-button');
	await expect(current).toHaveText('Approach');
	await press(page, 'right', 'a-button');
	await expect(current).toHaveText('Under the roof');
	await press(page, 'right', 'b-button');
	await expect(current).toHaveText('Approach');
	await press(page, 'right', 'b-button');
	await expect(current).toHaveText('Bench');
	expect(errors).toEqual([]);
});

test('X places a note where the right hand points', async ({ page }) => {
	const errors = collectErrors(page);
	await enterVR(page);
	// Pointed down and ahead, at the miniature on its table.
	await page.evaluate(() => {
		const right = (globalThis as any).__xr.controllers.right; // eslint-disable-line @typescript-eslint/no-explicit-any
		right.position.set(0.2, 1.3, -0.3);
		right.quaternion.set(Math.sin(-0.3), 0, 0, Math.cos(-0.3));
	});
	await frames(page);
	await press(page, 'left', 'x-button');
	await expect(page.locator('.note-text')).toHaveCount(1);
	expect(errors).toEqual([]);
});

test('grips scale the model, and the stick teleports and turns, without errors', async ({
	page
}) => {
	const errors = collectErrors(page);
	await enterVR(page);
	const set = (script: string) => page.evaluate(script);

	// Both grips, hands drawn together: the model shrinks.
	await set(`__xr.controllers.left.position.set(-0.4, 1.2, -0.4);
		__xr.controllers.right.position.set(0.4, 1.2, -0.4);
		__xr.controllers.left.updateButtonValue('squeeze', 1);
		__xr.controllers.right.updateButtonValue('squeeze', 1);`);
	await frames(page);
	await set(`__xr.controllers.left.position.set(-0.05, 1.2, -0.4);
		__xr.controllers.right.position.set(0.05, 1.2, -0.4);`);
	await frames(page);
	await set(`__xr.controllers.left.updateButtonValue('squeeze', 0);
		__xr.controllers.right.updateButtonValue('squeeze', 0);`);

	// One grip: drag the world.
	await set(`__xr.controllers.right.updateButtonValue('squeeze', 1);`);
	await frames(page);
	await set(`__xr.controllers.right.position.set(0.3, 1.0, -0.2);`);
	await frames(page);
	await set(`__xr.controllers.right.updateButtonValue('squeeze', 0);`);

	// Stick forward to aim, centre to go; then a flick to turn.
	await set(`__xr.controllers.right.updateAxes('thumbstick', 0, -1);`);
	await frames(page);
	await set(`__xr.controllers.right.updateAxes('thumbstick', 0, 0);`);
	await frames(page);
	await set(`__xr.controllers.right.updateAxes('thumbstick', 1, 0);`);
	await frames(page);
	await set(`__xr.controllers.right.updateAxes('thumbstick', 0, 0);`);

	// Walk with the left stick.
	await set(`__xr.controllers.left.updateAxes('thumbstick', 0.5, -1);`);
	await frames(page, 5);
	await set(`__xr.controllers.left.updateAxes('thumbstick', 0, 0);`);
	await frames(page);

	// Y twice: menu closed (it opens on entering) and open again.
	await press(page, 'left', 'y-button');
	await press(page, 'left', 'y-button');
	expect(errors).toEqual([]);
});

/*
 * Walking at 1:1 against the sample. The Bench camera looks out from in
 * front of the bench, its eye a little low for a standing person, so
 * arriving there leaves the feet just below the plinth (0.45 m). Stepping
 * back, the person should be carried up onto the plinth (or the bench) and
 * stopped by the back wall, whose face is at z = −3.5.
 *
 * Where the walk ended is read back the way a person would keep it: Save
 * view on the in-headset menu, pressed with the trigger, then the saved
 * view's position from storage. The menu opens in front of the head on
 * entering VR: the head starts at (0, 1.6, 0) facing −Z, so the panel's
 * centre is 0.6 m ahead and 0.2 m down, tilted 0.3 rad, and Save view sits
 * mid-row 0.078 m above it.
 *
 * The stick is held for wall-clock time, not a frame count: the emulated
 * headset renders at Quest 3 resolution on a software renderer, a few frames
 * a second, and the app's step is capped at 0.1 s a frame.
 */
test('walking is carried up onto the plinth and stopped by the wall', async ({ page }) => {
	const errors = collectErrors(page);
	await enterVR(page);
	await press(page, 'right', 'b-button'); // B from nothing: the last view, Bench
	await expect(page.locator('[aria-current="true"]')).toHaveText('Bench');

	await page.evaluate(`__xr.controllers.left.updateAxes('thumbstick', 0, 1)`);
	await page.waitForTimeout(5000);
	await page.evaluate(`__xr.controllers.left.updateAxes('thumbstick', 0, 0)`);
	await frames(page);

	await page.evaluate(`{
		const right = __xr.controllers.right;
		right.position.set(0, 1.4747, -0.2);
		right.quaternion.set(0, 0, 0, 1);
	}`);
	await frames(page);
	await press(page, 'right', 'trigger');
	await expect(page.getByRole('button', { name: 'View 1', exact: true })).toBeVisible();

	// Read back from storage through the app's own decoder: notes are a Yjs
	// document there (src/lib/store/doc.ts), plain TypeScript the test can run.
	const stored = await page.evaluate(() => localStorage.getItem('visus:notes:sample'));
	const [eyeX, eyeY, eyeZ] = readNotes(loadDoc(JSON.parse(stored!))).viewpoints[0].position;
	expect(Math.abs(eyeX)).toBeLessThan(0.5); // straight back, not slid sideways
	expect(eyeY - 1.6).toBeGreaterThan(0.4); // standing on the plinth or the bench
	expect(eyeZ).toBeLessThan(-2.7); // it did move back from the camera at −2.6
	expect(eyeZ).toBeGreaterThan(-3.5); // and never through the wall
	expect(errors).toEqual([]);
});
