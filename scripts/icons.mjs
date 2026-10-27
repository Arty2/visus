// Renders the app icons for the web app manifest from static/favicon.svg,
// with Chromium (Playwright's, already a dev dependency): `node scripts/icons.mjs`.
// PNGs because install prompts and launchers want them; the maskable one
// keeps the mark inside the safe zone launchers crop to a circle or squircle.
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync('static/favicon.svg', 'utf8');
const browser = await chromium.launch(
	process.env.CI ? {} : { executablePath: '/opt/pw-browsers/chromium' }
);
const page = await browser.newPage();

for (const [name, size, inset] of [
	['icon-192.png', 192, 0],
	['icon-512.png', 512, 0],
	['maskable-512.png', 512, 0.2]
]) {
	await page.setViewportSize({ width: size, height: size });
	const pad = Math.round(size * inset);
	await page.setContent(
		`<body style="margin:0;background:#07090c;display:grid;place-items:center;width:${size}px;height:${size}px">` +
			`<div style="width:${size - 2 * pad}px;height:${size - 2 * pad}px">${svg.replace('<svg', '<svg width="100%" height="100%"')}</div></body>`
	);
	await page.screenshot({ path: `static/icons/${name}`, omitBackground: false });
	console.log('wrote', name);
}
await browser.close();
