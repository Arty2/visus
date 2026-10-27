import { expect, test, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
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

// Two minutes a test, not one: each drives an emulated Quest 3 at its full
// resolution through a software renderer, a few frames a second, and under
// a full parallel run that alone can pass the usual minute.
test.describe.configure({ timeout: 120_000 });

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

/**
 * Aims the right controller, from 0.3 m behind, at a point on a panel given
 * in the panel's pixels. Panels are placed in front of a head at the start
 * pose, (0, 1.6, 0) looking down −z: `distance` ahead, `drop` below the
 * eye, tilted back 0.3 rad (viewer.ts, placePanel), so its lower half is
 * nearer. Pointing straight down −z keeps x and y, so the ray meets the
 * panel at exactly the point — from 0.3 m, outside the 0.2 m within which
 * a ray pointer ignores what it touches.
 */
async function aimAtPanel(
	page: Page,
	panel: { metres: number; width: number; height: number; distance: number; drop: number },
	px: number,
	py: number
) {
	const x = (px / panel.width - 0.5) * panel.metres;
	const y = (0.5 - py / panel.height) * ((panel.metres * panel.height) / panel.width);
	const at = [x, 1.6 - panel.drop + y * Math.cos(0.3), -panel.distance - y * Math.sin(0.3)];
	await page.evaluate(([x, y, z]) => {
		const right = (globalThis as any).__xr.controllers.right; // eslint-disable-line @typescript-eslint/no-explicit-any
		right.position.set(x, y, z + 0.3);
		right.quaternion.set(0, 0, 0, 1);
	}, at);
	await frames(page);
}

// The keyboard opened by a new note: 1024 × 684 px, 0.62 m wide.
const KEYBOARD = { metres: 0.62, width: 1024, height: 684, distance: 0.5, drop: 0.35 };

test('the headset keyboard writes a note', async ({ page }) => {
	const errors = collectErrors(page);
	await enterVR(page);
	await page.evaluate(() => {
		const right = (globalThis as any).__xr.controllers.right; // eslint-disable-line @typescript-eslint/no-explicit-any
		right.position.set(0.2, 1.3, -0.3);
		right.quaternion.set(Math.sin(-0.3), 0, 0, Math.cos(-0.3));
	});
	await frames(page);
	await press(page, 'left', 'x-button');
	await expect(page.locator('.note-text')).toHaveCount(1);

	// Keys are 88.6 px wide with 10 px between (viewer.ts, drawKeyboard).
	// A new note starts shifted: W, then lower-case e, then Save.
	await aimAtPanel(page, KEYBOARD, 166.9, 347);
	await press(page, 'right', 'trigger');
	await aimAtPanel(page, KEYBOARD, 267.6, 347);
	await press(page, 'right', 'trigger');
	await aimAtPanel(page, KEYBOARD, 857, 623);
	await press(page, 'right', 'trigger');

	await expect(page.locator('.note-text')).toHaveValue('We');
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
	// Four minutes: it waits on 50 rendered frames of walking, and with the
	// headset panels and pointers drawn too, a software renderer under a full
	// parallel run took more than two.
	test.setTimeout(240_000);
	const errors = collectErrors(page);
	await enterVR(page);
	await press(page, 'right', 'b-button'); // B from nothing: the last view, Bench
	await expect(page.locator('[aria-current="true"]')).toHaveText('Bench');

	await page.evaluate(`__xr.controllers.left.updateAxes('thumbstick', 0, 1)`);
	// Five seconds of walking, in frames as well as on the clock: the viewer
	// caps a frame's step at 0.1 s, so under a loaded run, frames slower than
	// that walk less than the clock says, and the test fell short of −2.7.
	// The wall stops anything longer.
	await Promise.all([page.waitForTimeout(5000), frames(page, 50)]);
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

/*
 * Drawing in the air: Draw on the in-headset menu, then the trigger held
 * while the hand moves. The menu's Draw button is second of four in its
 * row: 0.061 m left of the panel's centre and 0.084 m below it, which the
 * 0.3 rad tilt puts at (−0.061, 1.319, −0.575) in front of a head at the
 * start position.
 */
test('Draw on the headset menu turns the trigger into a pen', async ({ page }) => {
	const errors = collectErrors(page);
	await enterVR(page);
	await page.evaluate(`{
		const right = __xr.controllers.right;
		right.position.set(-0.061, 1.3194, -0.2);
		right.quaternion.set(0, 0, 0, 1);
	}`);
	await frames(page);
	await press(page, 'right', 'trigger');

	// Off the menu, then a stroke: trigger down, a sweep, trigger up.
	await page.evaluate(`{
		const right = __xr.controllers.right;
		right.position.set(0.3, 1.1, -0.3);
		right.quaternion.set(-0.2, 0, 0, 0.98);
		right.updateButtonValue('trigger', 1);
	}`);
	await frames(page);
	for (let i = 1; i <= 6; i++) {
		await page.evaluate(
			`__xr.controllers.right.position.set(${0.3 - i * 0.05}, ${1.1 + i * 0.02}, -0.3)`
		);
		await frames(page, 2);
	}
	await page.evaluate(`__xr.controllers.right.updateButtonValue('trigger', 0)`);
	await frames(page);

	await expect(page.locator('.sketch-row span')).toHaveText('1 sketch');
	expect(errors).toEqual([]);
});

// The same, with tracked hands instead of controllers: a pinch is the
// trigger, and the hand models load from this origin without errors.
test('a pinch presses the menu and draws, with tracked hands', async ({ page }) => {
	const errors = collectErrors(page);
	await enterVR(page);
	await page.evaluate(`__xr.primaryInputMode = 'hand'`);
	await frames(page, 5);
	const pinch = async (value: number) => {
		await page.evaluate(`__xr.hands.right.updatePinchValue(${value})`);
		await frames(page);
	};
	await page.evaluate(`{
		const right = __xr.hands.right;
		right.position.set(-0.061, 1.3194, -0.2);
		right.quaternion.set(0, 0, 0, 1);
	}`);
	await frames(page);
	await pinch(1);
	await pinch(0);

	await page.evaluate(`{
		const right = __xr.hands.right;
		right.position.set(0.3, 1.1, -0.3);
		right.quaternion.set(-0.2, 0, 0, 0.98);
	}`);
	await frames(page);
	await pinch(1);
	for (let i = 1; i <= 6; i++) {
		await page.evaluate(
			`__xr.hands.right.position.set(${0.3 - i * 0.05}, ${1.1 + i * 0.02}, -0.3)`
		);
		await frames(page, 2);
	}
	await pinch(0);

	await expect(page.locator('.sketch-row span')).toHaveText('1 sketch');
	expect(errors).toEqual([]);
});

// Spark draws splats into both eyes itself; a scan in a headset session
// must not throw anything.
test('a splat scan can be taken into VR', async ({ page }) => {
	const errors = collectErrors(page);
	await page.addInitScript({ path: iwer });
	await page.addInitScript(() => {
		const xr = (globalThis as unknown as { IWER: Record<string, unknown> }).IWER;
		const Device = xr.XRDevice as new (config: unknown) => { installRuntime(o: object): void };
		new Device(xr.metaQuest3).installRuntime({ forceInstall: true });
	});
	await ready(page);
	await page
		.getByLabel('Open model…')
		.setInputFiles(fileURLToPath(new URL('./fixtures/scan.splat', import.meta.url)));
	await expect(page.locator('.chip-title')).toHaveText('scan.splat', { timeout: 20_000 });
	await page.getByRole('button', { name: 'Enter VR' }).click();
	await expect(page.getByText('In VR — take the headset off')).toBeVisible();
	await frames(page, 10);
	expect(errors).toEqual([]);
});
