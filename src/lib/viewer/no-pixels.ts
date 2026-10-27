/*
 * Stands in for ndarray, ndarray-pixels and ndarray-lanczos inside the app
 * (aliased in vite.config.ts). glTF-Transform's functions package imports
 * them for its texture tools — resizing, palettes, solid-colour detection —
 * and ndarray-ops, which they pull in, compiles code from strings with
 * `new Function` the moment it's imported. The Content Security Policy
 * refuses that (no 'unsafe-eval', ever), so the whole module failed to load.
 *
 * visus uses none of those tools: optimise.ts runs dedup, instance,
 * flatten, join, weld and prune, and asks prune to keep solid textures,
 * which is prune's one route to pixels. If a future change reaches for one,
 * it fails here, loudly, rather than as a CSP error far from the cause.
 */

function unavailable(): never {
	throw new Error(
		'Texture pixel tools are not available in visus (see src/lib/viewer/no-pixels.ts).'
	);
}

export const getPixels = unavailable;
export const savePixels = unavailable;
export const lanczos2 = unavailable;
export const lanczos3 = unavailable;
export default unavailable;
