<script lang="ts">
	// IBM Plex, bundled from @fontsource: served from this origin like any
	// other asset, so `font-src 'self'` needs nothing new. Sans as one
	// variable file for every weight; Mono in the three weights used.
	import '@fontsource-variable/ibm-plex-sans/wght.css';
	import '@fontsource/ibm-plex-mono/400.css';
	import '@fontsource/ibm-plex-mono/500.css';
	import '@fontsource/ibm-plex-mono/600.css';
	import '../app.css';

	let { children } = $props();
</script>

{@render children()}
