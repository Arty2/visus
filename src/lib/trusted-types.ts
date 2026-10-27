/*
 * The one Trusted Types policy this app defines, and the only thing it lets
 * through: a `blob:` URL from this page's own origin, used as a script URL.
 *
 * Why it exists: three.js's Draco and KTX2 decoders run in Web Workers they
 * build from a blob (`new Worker(blobURL)`), and under
 * `require-trusted-types-for 'script'` a Worker URL must be a
 * TrustedScriptURL. The decoders pass plain strings and can't be changed, so
 * the policy is named `default` — the one the browser consults for a plain
 * string — and refuses everything but that one shape.
 *
 * What it does not open: no HTML (`createHTML` is absent, so every markup
 * sink still refuses strings), no inline script, no URL from another
 * origin or from `data:`. A blob URL holds bytes this tab already had;
 * whatever could create one could already run script.
 *
 * The gates allow `createPolicy` in this file and nowhere else.
 */

// Only the part used here: TypeScript's DOM library doesn't describe
// Trusted Types yet.
interface PolicyFactory {
	createPolicy(name: string, rules: { createScriptURL(url: string): string }): unknown;
}

let installed = false;

export function allowOwnBlobWorkers() {
	if (installed) return;
	installed = true;
	const tt = (globalThis as { trustedTypes?: PolicyFactory }).trustedTypes;
	// No Trusted Types in this browser means nothing is enforced either.
	if (!tt) return;
	tt.createPolicy('default', {
		createScriptURL(url: string) {
			if (url.startsWith(`blob:${location.origin}/`)) return url;
			throw new TypeError(`visus refuses script URL ${url}`);
		}
	});
}
