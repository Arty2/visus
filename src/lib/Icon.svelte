<script lang="ts" module>
	// Drawn on a 24-unit grid with a 1.75 stroke, so every icon has the same
	// weight as the text beside it. Inline SVG, not an icon font or a library:
	// a dozen paths cost less than either, and nothing is fetched.
	const PATHS = {
		open: 'M3 7.5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
		cube: 'M12 3 4 7.5v9L12 21l8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
		headset:
			'M3 9.5A2.5 2.5 0 0 1 5.5 7h13A2.5 2.5 0 0 1 21 9.5v5a2.5 2.5 0 0 1-2.5 2.5H16l-2-2.5h-4L8 17H5.5A2.5 2.5 0 0 1 3 14.5z',
		history: 'M4 12a8 8 0 1 0 2.3-5.6L4 8.5M4 4v4.5h4.5M12 8v4l3 2',
		camera:
			'M3 8.5A1.5 1.5 0 0 1 4.5 7H6l1.5-2h9L18 7h1.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5zM12 16a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5',
		pin: 'M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
		plus: 'M12 5v14M5 12h14',
		bookmark: 'M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z',
		pencil: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4',
		trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
		download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
		upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
		help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01',
		close: 'M6 6l12 12M18 6 6 18',
		arrow: 'M5 12h14M13 6l6 6-6 6'
	} as const;

	export type IconName = keyof typeof PATHS;
</script>

<script lang="ts">
	let { name, size = 20 }: { name: IconName; size?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	<path d={PATHS[name]} />
</svg>
