<script lang="ts">
	import { onMount } from 'svelte';
	// Bundled at build time, not fetched: it works offline, costs no request,
	// and can never disagree with the build it describes. scripts/gates.sh
	// fails the build if its top heading isn't this version.
	import changelogText from '../../CHANGELOG.md?raw';
	import { parseChangelog, segments, shouldAnnounce } from './changelog';

	// Prefixed with the project name like every other key — see notes.svelte.ts.
	const SEEN_KEY = 'visus:seen-version';

	const latest = parseChangelog(changelogText)[0];
	let dialog: HTMLDialogElement | undefined = $state();

	function open() {
		dialog?.showModal();
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
	<dialog bind:this={dialog} aria-labelledby="whats-new-title">
		<h2 id="whats-new-title">What's new in {latest.version}</h2>
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
		<form method="dialog">
			<button type="submit">Close</button>
		</form>
	</dialog>
{/if}

<style>
	.credit {
		margin-top: 2rem;
		opacity: 0.6;
		font-size: 0.875rem;
	}

	.version {
		font: inherit;
		padding: 0;
		border: none;
		background: none;
		color: inherit;
		text-decoration: underline dotted;
		cursor: pointer;
	}

	dialog {
		max-width: min(28rem, calc(100vw - 2rem));
		padding: 1.5rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		color: var(--ink);
	}

	dialog::backdrop {
		background: rgb(0 0 0 / 0.4);
	}

	h2 {
		margin: 0;
		font-size: 1.125rem;
	}

	.date {
		margin: 0.25rem 0 1rem;
		opacity: 0.6;
		font-size: 0.875rem;
	}

	ul {
		margin: 0 0 1.5rem;
		padding-left: 1.25rem;
	}

	li + li {
		margin-top: 0.5rem;
	}

	form button {
		font: inherit;
		padding: 0.5rem 1rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		color: var(--ink);
	}
</style>
