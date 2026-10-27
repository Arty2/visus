// Renders IBM Plex as multi-channel signed-distance-field atlases for the
// headset's panels (src/lib/viewer/ui.ts): `node scripts/fonts.mjs`, then
// commit static/msdf/. Run again only to change the glyphs or the weights.
//
// Why ahead of time: @pmndrs/uikit can generate these in the browser from a
// TrueType file, but its generator is Emscripten code that compiles
// JavaScript from strings, which the Content Security Policy refuses — and
// it would be seconds of work on a headset, every session. Here it runs
// once, in Playwright's Chromium (already a dev dependency), on a page with
// no policy, and what's committed is a PNG and a JSON file per weight.
//
// The fonts come from @ibm/plex-sans and @fontsource/ibm-plex-mono, which
// ship WOFF: TrueType tables zlib-compressed one by one, unwrapped below.
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { chromium } from '@playwright/test';

/**
 * The glyphs drawn: everything on a UK, US or Greek keyboard, the Latin-1
 * letters, and the punctuation the app writes. Anything else in a model's
 * name shows as a box — rare, and better than an atlas twice the size.
 */
const CHARSET =
	' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~' +
	'£€°±×÷·…–—‘’“”•→←✓' +
	'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝßàáâãäåæçèéêëìíîïñòóôõöøùúûüýÿ' +
	'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩΆΈΉΊΌΎΏαβγδεζηθικλμνξοπρσςτυφχψωάέήίόύώϊϋΐΰ';

const FONTS = {
	'plex-sans-400': 'node_modules/@ibm/plex-sans/fonts/complete/woff/IBMPlexSans-Regular.woff',
	'plex-sans-600': 'node_modules/@ibm/plex-sans/fonts/complete/woff/IBMPlexSans-SemiBold.woff',
	'plex-sans-700': 'node_modules/@ibm/plex-sans/fonts/complete/woff/IBMPlexSans-Bold.woff',
	'plex-mono-500':
		'node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff'
};
const out = 'static/msdf';

// The generator and its one dependency, served to the page as ES modules
// from node_modules: no bundler needed for three small files.
// pnpm puts each package's dependencies beside it, so each is found next
// to the one that needs it.
const uikit = realpathSync('node_modules/@pmndrs/uikit');
const generator = realpathSync(join(uikit, '../../@zappar/msdf-generator'));
const comlink = realpathSync(join(generator, '../../comlink'));
const files = {
	'/generator.js': join(generator, 'dist/index.js'),
	'/worker-source.js': join(uikit, 'dist/loaders/msdf-worker.js'),
	'/comlink.js': join(comlink, 'dist/esm/comlink.mjs')
};
const page = `<!doctype html><script type="importmap">{"imports":{"comlink":"/comlink.js"}}</script>`;

const browser = await chromium.launch(
	process.env.CI ? {} : { executablePath: '/opt/pw-browsers/chromium' }
);
const tab = await browser.newPage();
await tab.route('http://fonts.invalid/**', (route) => {
	const path = new URL(route.request().url()).pathname;
	if (path === '/') return route.fulfill({ contentType: 'text/html', body: page });
	return route.fulfill({ contentType: 'text/javascript', body: readFileSync(files[path]) });
});
await tab.goto('http://fonts.invalid/');
mkdirSync(out, { recursive: true });

for (const [name, woff] of Object.entries(FONTS)) {
	const font = woffToSfnt(readFileSync(woff)).toString('base64');
	const family = await tab.evaluate(
		async ({ font, charset }) => {
			const { MSDF } = await import('/generator.js');
			const { workerSource, wasmUrl } = await import('/worker-source.js');
			const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
			const msdf = new MSDF({ workerUrl, wasmUrl });
			await msdf.initialize();
			try {
				return await msdf.generate({
					font: Uint8Array.from(atob(font), (c) => c.charCodeAt(0)),
					charset,
					fontSize: 42,
					textureSize: [1024, 512],
					fieldRange: 4,
					padding: 4,
					fixOverlaps: true
				});
			} finally {
				await msdf.dispose();
			}
		},
		{ font, charset: CHARSET }
	);
	// Returned as { [name]: { [weight]: font } }; there's one of each.
	const result = Object.values(Object.values(family)[0])[0];
	if (result.pages.length !== 1) throw new Error(`${name}: ${result.pages.length} pages, want 1`);
	const [, png] = result.pages[0].split(',');
	writeFileSync(`${out}/${name}.png`, Buffer.from(png, 'base64'));
	result.pages = [`/msdf/${name}.png`];
	writeFileSync(`${out}/${name}.json`, JSON.stringify(result));
	const missing = [...CHARSET].filter((c) => !result.chars.some((g) => g.char === c));
	console.log(
		'wrote',
		name,
		result.chars.length,
		'glyphs',
		missing.length ? `missing ${missing.join('')}` : ''
	);
}
await browser.close();

/** WOFF 1.0 → the TrueType/OpenType file it wraps (w3.org/TR/WOFF). */
function woffToSfnt(woff) {
	if (woff.readUInt32BE(0) !== 0x774f4646) throw new Error('not a WOFF 1.0 file');
	const count = woff.readUInt16BE(12);
	const tables = [];
	for (let i = 0; i < count; i++) {
		const at = 44 + i * 20;
		const offset = woff.readUInt32BE(at + 4);
		const compLength = woff.readUInt32BE(at + 8);
		const origLength = woff.readUInt32BE(at + 12);
		const raw = woff.subarray(offset, offset + compLength);
		tables.push({
			tag: woff.readUInt32BE(at),
			checksum: woff.readUInt32BE(at + 16),
			data: compLength < origLength ? inflateSync(raw) : raw
		});
	}
	const pad = (n) => (n + 3) & ~3;
	const head = 12 + 16 * count;
	const sfnt = Buffer.alloc(tables.reduce((n, t) => n + pad(t.data.length), head));
	let power = 1;
	let log = 0;
	while (power * 2 <= count) {
		power *= 2;
		log++;
	}
	sfnt.writeUInt32BE(woff.readUInt32BE(4), 0);
	sfnt.writeUInt16BE(count, 4);
	sfnt.writeUInt16BE(power * 16, 6);
	sfnt.writeUInt16BE(log, 8);
	sfnt.writeUInt16BE(count * 16 - power * 16, 10);
	let offset = head;
	tables.forEach((t, i) => {
		const at = 12 + i * 16;
		sfnt.writeUInt32BE(t.tag, at);
		sfnt.writeUInt32BE(t.checksum, at + 4);
		sfnt.writeUInt32BE(offset, at + 8);
		sfnt.writeUInt32BE(t.data.length, at + 12);
		t.data.copy(sfnt, offset);
		offset += pad(t.data.length);
	});
	return sfnt;
}
