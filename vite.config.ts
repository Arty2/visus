import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';

/*
 * The version shown anywhere in the UI is read from package.json rather than
 * written out a second time, so a release cannot leave the app claiming an
 * old one — and scripts/gates.sh holds CHANGELOG.md to the same number.
 * See AGENTS.md § Versioning.
 */
const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
	define: {
		__VERSION__: JSON.stringify(version)
	},
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except inside dependencies.
				// Can be removed once Svelte 6 makes it the only mode.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Pinned rather than adapter-auto, so CI and Vercel build identically.
			// Bump this in step with the Node version in package.json#engines.
			adapter: adapter({ runtime: 'nodejs22.x' }),

			/*
			 * Strict on what actually matters for a browser talking to strangers —
			 * third-party script origins, markup injection, framing — and
			 * deliberately loose on the local-first mechanics that cost nothing to
			 * allow. See TECHNICAL.md § Content Security Policy for the reasoning,
			 * including why this is looser than the sibling projects this skeleton
			 * was drawn from (they hold a secret key in memory; a generic skeleton
			 * doesn't, and shouldn't borrow their threat model by default).
			 *
			 * Configured here rather than a hand-written meta tag, because a
			 * hand-written policy and SvelteKit's hydration script do not coexist —
			 * 'auto' uses hashes for prerendered pages and nonces for dynamic ones.
			 * `trusted-types svelte-trusted-html` is load-bearing: Svelte writes its
			 * own templates through innerHTML behind a policy of that name, and
			 * Chrome refuses to hydrate without it allow-listed.
			 */
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					// 'wasm-unsafe-eval' permits compiling WebAssembly — not arbitrary
					// eval of strings — so a local-first feature built on WASM (an
					// in-browser SQLite via sql.js/wa-sqlite, an image codec) works
					// without loosening anything that would let injected text run as
					// script. Nothing here uses it yet; it's headroom, not a feature.
					'script-src': ['self', 'wasm-unsafe-eval'],
					/*
					 * 'self' plus exactly one pinned hash, and nothing else.
					 * SvelteKit's own #svelte-announcer element carries a hardcoded
					 * style="..." attribute that this project does not author and
					 * cannot switch off. 'unsafe-hashes' is what lets a hash apply to
					 * a style attribute at all — it does not permit inline styles
					 * generally, only this one exact string.
					 *
					 * If a SvelteKit upgrade changes that string, e2e/csp.e2e.ts fails
					 * on the resulting console error rather than the app quietly
					 * shipping a broken policy.
					 */
					'style-src': [
						'self',
						'unsafe-hashes',
						'sha256-S8qMpvofolR8Mpjy4kQvEm7m1q8clzU4dfDH0AmvZjo='
					],
					// data: and blob: for images only — a picture can't execute
					// script, so this costs nothing while unblocking a canvas export,
					// a generated thumbnail, or a preview of a file just picked for
					// import. Vite's default small-asset inlining (data: URIs) is on
					// for the same reason — see src/lib/io/download.ts.
					'img-src': ['self', 'data:', 'blob:'],
					'font-src': ['self'],
					// blob: alongside 'self' for the same reason it's in img-src and
					// worker-src: a blob URL is this tab's own memory, so fetching one
					// back (how several file-reading helpers are written) opens no
					// network path that 'self' didn't already allow.
					'connect-src': ['self', 'blob:'],
					'manifest-src': ['self'],
					// blob: because reading a large local import or running work off
					// the main thread — a Web Worker created from a bundler-inlined
					// blob, exactly how kalendes's ics.worker.ts pattern works — is
					// precisely the kind of local-first feature this posture exists
					// not to block.
					'worker-src': ['self', 'blob:'],
					'object-src': ['none'],
					'base-uri': ['none'],
					'form-action': ['self'],
					/*
					 * Kept for any route that is ever served dynamically — but note
					 * that it does nothing on the prerendered pages this app is made
					 * of. `frame-ancestors` is ignored in a `<meta>` CSP by
					 * specification, and SvelteKit correctly drops it when it writes
					 * the tag, so the built HTML never carries it. What actually stops
					 * this app being framed is `X-Frame-Options` and a one-directive
					 * `Content-Security-Policy` response header, both in vercel.json.
					 * See TECHNICAL.md § Security headers.
					 */
					'frame-ancestors': ['none'],
					'require-trusted-types-for': ['script'],
					// Both created by the framework: Svelte for its own template
					// writes, SvelteKit for the service worker registration URL (if
					// one is ever added). SvelteKit refuses to build without the
					// second once a worker exists.
					'trusted-types': ['svelte-trusted-html', 'sveltekit-trusted-url'],
					'upgrade-insecure-requests': true
				}
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'unit',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
