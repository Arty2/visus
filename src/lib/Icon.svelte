<script lang="ts">
	import { icons, type CarbonNode, type IconName } from './icons';

	let { name, size = 20 }: { name: IconName; size?: number } = $props();
	const icon = $derived(icons[name]);
</script>

<!-- Rendered from Carbon's description element by element — no markup
     strings, so nothing here passes through an HTML sink. -->
{#snippet node(n: CarbonNode)}
	<!-- xmlns is not decoration: an icon drawn in the browser (rather than
	     prerendered) would otherwise get HTML-namespaced <path>s, which draw
	     nothing. -->
	<svelte:element this={n.elem} xmlns="http://www.w3.org/2000/svg" {...n.attrs}>
		{#each n.content ?? [] as child, i (i)}{@render node(child)}{/each}
	</svelte:element>
{/snippet}

<svg
	width={size}
	height={size}
	viewBox={String(icon.attrs.viewBox)}
	fill="currentColor"
	aria-hidden="true"
	focusable="false"
>
	{#each icon.content as child, i (i)}{@render node(child)}{/each}
</svg>
