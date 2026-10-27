<script lang="ts">
	import { itemsStore } from '$lib/store/items.svelte';
	import { downloadText } from '$lib/io/download';
	import { fromJSON, toJSON } from '$lib/io/json';
	import { fromMarkdown, toMarkdown } from '$lib/io/markdown';
	import WhatsNew from '$lib/WhatsNew.svelte';

	let draft = $state('');
	let importError = $state('');
	let fileInput: HTMLInputElement | undefined = $state();

	const empty = $derived(itemsStore.items.length === 0);

	function addDraft(event: SubmitEvent) {
		event.preventDefault();
		itemsStore.add(draft);
		draft = '';
	}

	function exportJSON() {
		downloadText('items.json', 'application/json', toJSON(itemsStore.items));
	}

	function exportMarkdown() {
		downloadText('items.md', 'text/markdown', toMarkdown(itemsStore.items));
	}

	async function importFile(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		importError = '';

		try {
			const text = await file.text();
			const looksLikeJSON =
				file.name.endsWith('.json') ||
				text.trimStart().startsWith('{') ||
				text.trimStart().startsWith('[');
			const items = looksLikeJSON ? fromJSON(text) : fromMarkdown(text);

			// One refusal, in one place, for both formats: the parsers report
			// what a file contains and this decides what to do about it. An
			// import that would empty the list is almost always the wrong file
			// (a README parses as zero items perfectly happily), and nothing can
			// tell that apart from someone deliberately importing an empty list.
			if (items.length === 0) throw new Error('That file contains no items.');

			const count = `${items.length} item${items.length === 1 ? '' : 's'}`;
			itemsStore.replace(items, `Imported ${count} from “${file.name}”.`);
		} catch (err) {
			importError = err instanceof Error ? err.message : 'Could not read that file.';
		} finally {
			// Cleared so picking the same file twice fires change again.
			if (fileInput) fileInput.value = '';
		}
	}
</script>

<svelte:head>
	<title>osseus</title>
</svelte:head>

<main>
	<h1>osseus</h1>
	<p>
		A skeleton, not an app — this list is the whole demo. It's local-first (nothing here ever leaves
		the browser) and every action below is the pattern to copy for real data: see
		<code>src/lib/store</code> and <code>src/lib/io</code>.
	</p>

	<form onsubmit={addDraft}>
		<label class="visually-hidden" for="draft">New item</label>
		<input id="draft" class="draft" bind:value={draft} placeholder="Add something…" />
		<button type="submit">Add</button>
	</form>

	<ul>
		{#each itemsStore.items as item (item.id)}
			<li>
				<label>
					<input type="checkbox" checked={item.done} onchange={() => itemsStore.toggle(item.id)} />
					<span class:done={item.done}>{item.text}</span>
				</label>
				<!-- Unquoted here on purpose: quotation marks disambiguate where a
				     name stops on screen, and read aloud they are either noise or
				     silence. The visible message in the undo offer quotes it. -->
				<button
					type="button"
					aria-label={`Remove ${item.text}`}
					onclick={() => itemsStore.remove(item.id)}
				>
					×
				</button>
			</li>
		{/each}
	</ul>

	{#if empty}
		<p class="quiet">Nothing on the list. Add something, or import a file.</p>
	{/if}

	<div class="io">
		<button type="button" onclick={exportJSON} disabled={empty}>Export JSON</button>
		<button type="button" onclick={exportMarkdown} disabled={empty}>Export Markdown</button>
		<label class="import">
			Import
			<input
				bind:this={fileInput}
				type="file"
				accept=".json,application/json,.md,.markdown,text/markdown"
				onchange={importFile}
			/>
		</label>
	</div>

	{#if itemsStore.undoable}
		<p class="notice" role="status">
			{itemsStore.undoable.label}
			<button type="button" onclick={() => itemsStore.undo()}>Undo</button>
		</p>
	{/if}

	{#if importError}
		<p class="notice" role="alert">{importError}</p>
	{/if}

	{#if itemsStore.storageBroken}
		<p class="notice" role="alert">
			This browser refused to save. The list works in this tab, but it won't survive a reload —
			export it if you want to keep it.
		</p>
	{/if}

	<WhatsNew />
</main>

<style>
	main {
		max-width: 32rem;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(100%);
		white-space: nowrap;
	}

	form {
		display: flex;
		gap: 0.5rem;
		margin-block: 1.5rem;
	}

	.draft {
		flex: 1;
		font: inherit;
		padding: 0.5rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		color: var(--ink);
	}

	button {
		font: inherit;
		padding: 0.5rem 1rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		color: var(--ink);
	}

	button:disabled {
		opacity: 0.4;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding-block: 0.375rem;
		border-bottom: 1px solid var(--ink);
	}

	li label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.done {
		text-decoration: line-through;
		opacity: 0.6;
	}

	.io {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 1.5rem;
	}

	.import {
		display: inline-flex;
		align-items: center;
		padding: 0.5rem 1rem;
		border: 1px solid var(--ink);
		cursor: pointer;

		& input {
			/* Visually hidden, not display:none — it still needs to receive
			   focus and its change event for keyboard and screen-reader use. */
			position: absolute;
			width: 1px;
			height: 1px;
			overflow: hidden;
			clip-path: inset(100%);
		}
	}

	/* One treatment for everything the app says back — an undo offer, an
	   error, a warning. They differ in what they say and in their role, not
	   in colour: there are two colours here and neither of them is red. */
	.notice {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
		padding: 0.5rem 0.75rem;
		border: 1px dashed var(--ink);
	}

	.notice button {
		padding: 0.25rem 0.75rem;
	}

	.quiet {
		margin-top: 1rem;
		opacity: 0.6;
	}
</style>
