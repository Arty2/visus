<script lang="ts">
	import { Tooltip } from 'bits-ui';
	import type { Snippet } from 'svelte';

	// A tooltip on whatever button it wraps, from Bits UI: shown on hover and
	// on keyboard focus, dismissed with Escape, and announced properly — which
	// a `title` attribute is none of. The button itself is the caller's, so
	// it keeps its own name, classes and handlers.
	let { label, children }: { label: string; children: Snippet<[Record<string, unknown>]> } =
		$props();
</script>

<Tooltip.Root delayDuration={350}>
	<Tooltip.Trigger>
		{#snippet child({ props })}{@render children(props)}{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Portal>
		<Tooltip.Content class="tip" sideOffset={8}>{label}</Tooltip.Content>
	</Tooltip.Portal>
</Tooltip.Root>
