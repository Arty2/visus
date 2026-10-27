/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

/*
 * What makes visus installable and usable offline — in the Quest's app
 * library, or a desktop's. SvelteKit builds and registers this file itself,
 * through its own Trusted Types policy (sveltekit-trusted-url, already in
 * the CSP), so a service worker needs nothing loosened.
 *
 * Everything the app is — the page, its scripts and styles, the fonts, the
 * decoders, the icons — is cached on install (all but the headset's
 * controller models, below), keyed by build version, and
 * served from the cache first: it can't change until the next deploy, which
 * brings a new cache and drops the old. Anything else (nothing, today: the
 * app makes no requests of its own) goes to the network, falling back to
 * the cache. Models and notes never pass through here: they're read from
 * files and kept in the browser's storage.
 */
import { build, files, prerendered, version } from '$service-worker';

const worker = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `visus-${version}`;
// The controller and hand models (static/xr, ~8 MB, scripts/xr-assets.mjs)
// are left out of the install: a desktop visitor never needs them, and a
// headset fetches only its own. They're kept as they're first fetched.
const ON_DEMAND = '/xr/';
const APP = new Set([...build, ...files.filter((f) => !f.startsWith(ON_DEMAND)), ...prerendered]);

worker.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll([...APP]))
			// A new build takes over at once, rather than after every tab closes.
			.then(() => worker.skipWaiting())
	);
});

worker.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => worker.clients.claim())
	);
});

worker.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== worker.location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			if (APP.has(url.pathname)) {
				const hit = await cache.match(url.pathname);
				if (hit) return hit;
			}
			if (url.pathname.startsWith(ON_DEMAND)) {
				const kept = await cache.match(url.pathname);
				if (kept) return kept;
				const response = await fetch(request);
				if (response.ok) await cache.put(url.pathname, response.clone());
				return response;
			}
			try {
				return await fetch(request);
			} catch (err) {
				// Offline: a page request gets the app itself.
				const fallback =
					(await cache.match(request)) ??
					(request.mode === 'navigate' ? await cache.match('/') : undefined);
				if (fallback) return fallback;
				throw err;
			}
		})()
	);
});
