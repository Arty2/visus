<script lang="ts">
	import { onMount } from 'svelte';
	// Bundled at build time, not fetched: it works offline, costs no request,
	// and can never disagree with the build it describes. scripts/gates.sh
	// fails the build if its top heading isn't this version.
	import changelogText from '../../CHANGELOG.md?raw';
	import { parseChangelog, segments, shouldAnnounce } from './changelog';
	import { Dialog } from 'bits-ui';

	// Prefixed with the project name like every other key — see notes.svelte.ts.
	const SEEN_KEY = 'visus:seen-version';

	const latest = parseChangelog(changelogText)[0];
	let opened = $state(false);

	function open() {
		opened = true;
		markSeen();
	}

	// Storage can throw (a private window, a blocked profile). Losing this only
	// means the dialog might open once more than it should, so it's not worth
	// telling anyone about — unlike a lost item, see notes.svelte.ts.
	function markSeen() {
		try {
			localStorage.setItem(SEEN_KEY, __VERSION__);
		} catch {
			// Nothing to do.
		}
	}

	onMount(() => {
		let lastSeen: string | null;
		try {
			lastSeen = localStorage.getItem(SEEN_KEY);
		} catch {
			return;
		}
		if (latest && shouldAnnounce(lastSeen, __VERSION__)) open();
		else markSeen();
	});
</script>

<!-- The version is the way in, so the number someone reports in a bug is the
     same thing they click to see what changed. -->
<p class="credit">
	{#if latest}
		<button type="button" class="version" aria-haspopup="dialog" onclick={open}>
			v{__VERSION__}
		</button>
	{:else}
		v{__VERSION__}
	{/if}
</p>

{#if latest}
	<Dialog.Root bind:open={opened}>
		<Dialog.Portal>
			<Dialog.Overlay class="overlay" />
			<Dialog.Content class="dialog narrow">
				<Dialog.Title class="dialog-title">What's new in {latest.version}</Dialog.Title>
				<p class="date"><time datetime={latest.date}>{latest.date}</time></p>
				<ul>
					{#each latest.lines as line, i (i)}
						<li>
							{#each segments(line) as segment, j (j)}
								{#if segment.code}<code>{segment.text}</code>{:else}{segment.text}{/if}
							{/each}
						</li>
					{/each}
				</ul>
				<Dialog.Close class="close-button">Close</Dialog.Close>
			</Dialog.Content>
		</Dialog.Portal>
	</Dialog.Root>
{/if}

<style>
	.credit {
		margin: 0;
		font-family: var(--mono);
		font-size: 0.85rem;
		color: var(--text-dim);
	}

	.version {
		padding: 0.25rem 0.6rem;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.version:hover {
		border-color: var(--accent-line);
		color: var(--accent);
	}

	.date {
		margin: 0.25rem 0 1.25rem;
		color: var(--accent);
		font-family: var(--mono);
		font-size: 0.85rem;
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		margin: 0 0 1.5rem;
		padding: 0;
		list-style: none;
	}

	li {
		padding: 0.7rem 0.9rem;
		border: 1px solid var(--line);
		border-left: 3px solid var(--accent);
		border-radius: 11px;
		background: var(--surface);
	}

	:global(.close-button) {
		width: 100%;
		min-height: 2.75rem;
		border: 1px solid var(--accent);
		border-radius: 11px;
		background: var(--accent);
		color: var(--accent-ink);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}
</style>
