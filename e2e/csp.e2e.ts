import { expect, test } from '@playwright/test';
import vercel from '../vercel.json' with { type: 'json' };
import { placeNote, ready } from './helpers';

// A CSP violation lands in the console, not in a failed request — Chromium
// still renders the page and nothing else says the policy broke. This is
// the tripwire: a SvelteKit or dependency upgrade that changes a hashed
// inline script or style (the #svelte-announcer style in vite.config.ts is
// the known fragile one), or a future feature that needs a directive this
// project hasn't allow-listed, fails here instead of shipping quietly.
//
// Exercises the local-first export/import path deliberately: that's the
// flow most likely to need something CSP doesn't already allow (a blob:
// URL, a worker) as this skeleton grows.
// The model loaders have their own run under this policy in models.e2e.ts,
// and the headset in xr.e2e.ts.
test('the viewer loads and the note export/import flow runs with no console errors', async ({
	page
}) => {
	const errors: string[] = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error') errors.push(msg.text());
	});
	page.on('pageerror', (err) => errors.push(String(err)));

	await ready(page);
	await placeNote(page, 'csp check');

	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export JSON' }).click()
	]);
	const path = await download.path();
	await page.getByLabel('Import notes').setInputFiles(path!);

	expect(errors).toEqual([]);
});

/*
 * The test above is necessary and not sufficient, which is worth stating
 * plainly: it passes just as happily against a page carrying no CSP at all,
 * because a policy that doesn't exist is never violated. The kit config
 * living inline in vite.config.ts rather than in a svelte.config.js makes
 * "silently ignored" a real possibility rather than a paranoid one.
 *
 * So this reads the policy the browser actually received. See
 * TECHNICAL.md § Security headers for the directive that isn't here.
 */
test('the policy the browser receives is the one that was configured', async ({ page }) => {
	await page.goto('/');
	const csp = await page
		.locator('meta[http-equiv="content-security-policy"]')
		.getAttribute('content');

	expect(csp, 'no CSP reached the browser at all').toBeTruthy();
	expect(csp).toContain("default-src 'self'");
	expect(csp).toContain("object-src 'none'");
	expect(csp).toContain("base-uri 'none'");
	expect(csp).toContain("script-src 'self'");
	// The deliberate local-first allowances — see TECHNICAL.md § Content
	// Security Policy. Asserted so that "tighten the CSP" as a tidy-up has to
	// argue with a test rather than silently break a future worker or export.
	expect(csp).toContain('blob:');
	// Embedded glTF buffers — see vite.config.ts.
	expect(csp).toMatch(/connect-src [^;]*data:/);
	expect(csp).toContain("'wasm-unsafe-eval'");

	// Not a bug, and not ours: `frame-ancestors` is ignored in a meta CSP by
	// specification, and SvelteKit drops it rather than emit something inert.
	// Asserted so that if a future version starts emitting it, this fails and
	// someone re-reads whether the vercel.json header below is still needed.
	expect(csp).not.toContain('frame-ancestors');
});

test('framing is refused by a real response header, since the meta CSP cannot', async () => {
	const global = vercel.headers.find((rule) => rule.source === '/(.*)');
	const byKey = (key: string) => global?.headers.find((h) => h.key === key)?.value;

	expect(byKey('Content-Security-Policy')).toContain("frame-ancestors 'none'");
	expect(byKey('X-Frame-Options')).toBe('DENY');
});
