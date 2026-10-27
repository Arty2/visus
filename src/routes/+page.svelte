<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { notesStore } from '$lib/store/notes.svelte';
	import { downloadText } from '$lib/io/download';
	import { fromJSON, toJSON } from '$lib/io/json';
	import { fromMarkdown, toMarkdown } from '$lib/io/markdown';
	import type { ModelNotes } from '$lib/store/notes';
	import type { Viewer } from '$lib/viewer/viewer';
	import type { ViewTarget } from '$lib/viewer/views';
	import WhatsNew from '$lib/WhatsNew.svelte';

	let container: HTMLDivElement | undefined = $state();
	let modelInput: HTMLInputElement | undefined = $state();
	let notesInput: HTMLInputElement | undefined = $state();
	// Raw: three.js objects must never be wrapped in a reactive proxy.
	let viewer: Viewer | null = $state.raw(null);
	let fileViews: ViewTarget[] = $state.raw([]);
	let modelName = $state('');
	let loading = $state(false);
	let loadError = $state('');
	let missing: string[] = $state([]);
	let recentName = $state('');
	let xrSupported: boolean | null = $state(null);
	let xrError = $state('');
	let inVR = $state(false);
	let addMode = $state(false);
	let currentView = $state(-1);
	let importError = $state('');
	/** The saved view whose name is being edited in place, if any. */
	let renaming: string | null = $state(null);

	const views: ViewTarget[] = $derived([
		...fileViews,
		...notesStore.viewpoints.map((v) => ({ ...v, pitch: 0, saved: true }))
	]);
	const noNotes = $derived(notesStore.annotations.length === 0);

	// The viewer is told, never asked: these keep it in step with the store.
	$effect(() => {
		viewer?.setNotes($state.snapshot(notesStore.annotations));
	});
	$effect(() => {
		viewer?.setViews($state.snapshot(views));
	});
	$effect(() => {
		viewer?.setAddMode(addMode);
	});

	onMount(() => {
		let disposed = false;
		let created: Viewer | null = null;

		(async () => {
			// three.js is most of this app's weight; importing it here, not at
			// the top, lets the page paint before it arrives.
			const [{ Viewer }, { recallFiles }] = await Promise.all([
				import('$lib/viewer/viewer'),
				import('$lib/viewer/recent')
			]);
			if (disposed || !container) return;
			created = new Viewer(container, {
				addNote: (position) => notesStore.addAnnotation(position).id,
				setNoteText: (id, text) => notesStore.setText(id, text),
				toggleNote: (id) => notesStore.toggle(id),
				deleteNote: (id) => notesStore.removeAnnotation(id),
				discardIfEmpty: (id) => notesStore.discardIfEmpty(id),
				saveView: (position, yaw) => notesStore.addViewpoint(position, yaw),
				viewChanged: (index) => (currentView = index),
				noteSelected: (id) => void focusNote(id),
				sessionChanged: (active) => (inVR = active)
			});
			created.notesById = (id) => notesStore.annotations.find((a) => a.id === id);
			viewer = created;
			await openSample();

			const recent = await recallFiles();
			if (recent?.length) recentName = recent[0].name;
		})();

		navigator.xr
			?.isSessionSupported('immersive-vr')
			.then((ok) => (xrSupported = ok))
			.catch(() => (xrSupported = false));
		if (!navigator.xr) xrSupported = false;

		return () => {
			disposed = true;
			created?.dispose();
		};
	});

	async function openSample() {
		const { buildSample, SAMPLE_NAME } = await import('$lib/viewer/sample');
		const { camerasIn } = await import('$lib/viewer/views');
		const root = buildSample();
		show(root, SAMPLE_NAME, 'sample', camerasIn(root), []);
	}

	function show(
		root: import('three').Object3D,
		name: string,
		key: string,
		cameras: ViewTarget[],
		missingFiles: string[]
	) {
		viewer?.setModel(root, name);
		fileViews = cameras;
		modelName = name;
		missing = missingFiles;
		currentView = -1;
		addMode = false;
		notesStore.open(key);
	}

	async function openFiles(files: File[], remember: boolean) {
		if (!files.length) return;
		loading = true;
		loadError = '';
		try {
			const [{ loadFiles }, { rememberFiles }] = await Promise.all([
				import('$lib/viewer/load'),
				import('$lib/viewer/recent')
			]);
			const model = await loadFiles(files);
			show(model.root, model.name, model.key, model.views, model.missing);
			if (remember) {
				await rememberFiles(files);
				recentName = model.name;
			}
		} catch (err) {
			loadError = err instanceof Error ? err.message : 'Couldn’t open that model.';
		} finally {
			loading = false;
			if (modelInput) modelInput.value = '';
		}
	}

	async function reopen() {
		const { recallFiles } = await import('$lib/viewer/recent');
		const files = await recallFiles();
		if (files) await openFiles(files, false);
		else recentName = '';
	}

	async function enterVR() {
		xrError = '';
		try {
			await viewer?.enterVR();
		} catch (err) {
			xrError = err instanceof Error ? err.message : 'The headset refused to start VR.';
		}
	}

	function saveDesktopView() {
		if (!viewer) return;
		const { position, yaw } = viewer.currentView();
		notesStore.addViewpoint(position, yaw);
	}

	async function focusNote(id: string) {
		await tick();
		document.getElementById(`note-${id}`)?.focus();
		addMode = false;
	}

	const fileStem = $derived(modelName.replace(/\.[^.]+$/, '') || 'notes');

	function exportJSON() {
		downloadText(
			`${fileStem}.notes.json`,
			'application/json',
			toJSON(notesStore.snapshot(), modelName)
		);
	}

	function exportMarkdown() {
		downloadText(
			`${fileStem}.notes.md`,
			'text/markdown',
			toMarkdown(notesStore.snapshot().annotations, modelName)
		);
	}

	async function importNotes(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		importError = '';
		try {
			const text = await file.text();
			const looksLikeJSON = file.name.endsWith('.json') || text.trimStart().startsWith('{');
			const notes: ModelNotes = looksLikeJSON
				? fromJSON(text)
				: { annotations: fromMarkdown(text), viewpoints: [] };
			const count = notes.annotations.length + notes.viewpoints.length;
			// One refusal for both formats: an import with nothing in it is
			// almost always the wrong file, and applying it would wipe the notes.
			if (count === 0) throw new Error('That file contains no notes.');
			// Markdown can't carry viewpoints, so it leaves the saved ones alone.
			if (!looksLikeJSON) notes.viewpoints = notesStore.snapshot().viewpoints;
			notesStore.replace(notes, `Imported ${count} from “${file.name}”.`);
		} catch (err) {
			importError = err instanceof Error ? err.message : 'Could not read that file.';
		} finally {
			if (notesInput) notesInput.value = '';
		}
	}
</script>

<svelte:head>
	<title>visus</title>
</svelte:head>

<main>
	<header>
		<h1>visus</h1>
		<p class="lede">Walk through a 3D model in a Meta Quest, and leave notes in it.</p>
	</header>

	<div class="toolbar">
		<!-- No `accept` filter, on purpose: Android-based browsers, the Quest's
		     among them, match it by MIME type, and .glb and .dae have none they
		     recognise — the files show greyed out and can't be picked. What
		     was picked is checked after (src/lib/viewer/files.ts). -->
		<label class="button primary">
			Open model…
			<input
				bind:this={modelInput}
				type="file"
				multiple
				onchange={(e) => openFiles([...(e.currentTarget.files ?? [])], true)}
			/>
		</label>
		{#if recentName && recentName !== modelName}
			<button type="button" onclick={reopen}>Reopen {recentName}</button>
		{/if}
		<button type="button" onclick={openSample} disabled={!viewer}>Sample</button>
		<button
			type="button"
			class="vr"
			onclick={enterVR}
			disabled={!viewer || !xrSupported || inVR}
			aria-describedby="vr-hint"
		>
			Enter VR
		</button>
	</div>
	<p id="vr-hint" class="quiet small">
		{#if xrSupported === false}
			VR needs a headset: open this page in the Meta Quest Browser. Everything else works here.
		{:else if inVR}
			In VR — take the headset off any time; the page keeps your notes in step.
		{:else}
			Open a <code>.glb</code>, <code>.gltf</code> or <code>.dae</code> — pick its textures with it.
		{/if}
	</p>

	{#if loading}<p class="notice" role="status">Opening…</p>{/if}
	{#if loadError}<p class="notice" role="alert">{loadError}</p>{/if}
	{#if xrError}<p class="notice" role="alert">{xrError}</p>{/if}
	{#if missing.length}
		<p class="notice" role="status">
			Shown without {missing.length === 1 ? 'a file' : `${missing.length} files`} it refers to — open
			them together with the model: {missing.join(', ')}
		</p>
	{/if}

	<div class="layout">
		<div class="viewport" bind:this={container}>
			{#if !viewer}<p class="quiet loading">Loading the viewer…</p>{/if}
		</div>

		<aside>
			<h2 class="model-name">{modelName || 'No model'}</h2>

			<section aria-labelledby="views-title">
				<h3 id="views-title">Views</h3>
				{#if views.length}
					<ol class="views">
						{#each views as view, i (view.id)}
							<li class:current={i === currentView}>
								{#if renaming === view.id}
									<!-- svelte-ignore a11y_autofocus -->
									<input
										class="note-text"
										value={view.name}
										aria-label={`New name for ${view.name}`}
										autofocus
										onkeydown={(e) => {
											if (e.key === 'Enter') e.currentTarget.blur();
											if (e.key === 'Escape') {
												e.currentTarget.value = view.name;
												e.currentTarget.blur();
											}
										}}
										onblur={(e) => {
											notesStore.renameViewpoint(view.id, e.currentTarget.value);
											renaming = null;
										}}
									/>
								{:else}
									<button
										type="button"
										class="go"
										onclick={() => viewer?.goToView(i)}
										aria-current={i === currentView ? 'true' : undefined}
									>
										{view.name}
									</button>
								{/if}
								{#if view.saved && renaming !== view.id}
									<button
										type="button"
										class="small-button"
										aria-label={`Rename ${view.name}`}
										onclick={() => (renaming = view.id)}>Rename</button
									>
									<button
										type="button"
										class="small-button"
										aria-label={`Delete ${view.name}`}
										onclick={() => notesStore.removeViewpoint(view.id)}>×</button
									>
								{/if}
							</li>
						{/each}
					</ol>
				{:else}
					<p class="quiet small">No cameras in this model yet.</p>
				{/if}
				<button type="button" onclick={saveDesktopView} disabled={!viewer || !modelName}>
					Save this view
				</button>
			</section>

			<section aria-labelledby="notes-title">
				<h3 id="notes-title">Notes</h3>
				<button
					type="button"
					aria-pressed={addMode}
					onclick={() => (addMode = !addMode)}
					disabled={!viewer || !modelName}
				>
					{addMode ? 'Click the model to place it…' : 'Add note'}
				</button>
				{#if noNotes}
					<p class="quiet small">None yet. Add one here, or with X in VR.</p>
				{:else}
					<ul class="notes">
						{#each notesStore.annotations as note, i (note.id)}
							<li>
								<input
									type="checkbox"
									checked={note.done}
									aria-label={`Resolved: note ${i + 1}`}
									onchange={() => notesStore.toggle(note.id)}
								/>
								<input
									id={`note-${note.id}`}
									class="note-text"
									class:done={note.done}
									value={note.text}
									placeholder="Write a note…"
									aria-label={`Note ${i + 1}`}
									onchange={(e) => notesStore.setText(note.id, e.currentTarget.value.trim())}
								/>
								<button
									type="button"
									class="small-button"
									aria-label={`Delete note ${i + 1}`}
									onclick={() => notesStore.removeAnnotation(note.id)}>×</button
								>
							</li>
						{/each}
					</ul>
				{/if}

				<div class="io">
					<button type="button" onclick={exportMarkdown} disabled={noNotes}>Export Markdown</button>
					<button
						type="button"
						onclick={exportJSON}
						disabled={noNotes && !notesStore.viewpoints.length}>Export JSON</button
					>
					<label class="button">
						Import notes
						<input
							bind:this={notesInput}
							type="file"
							accept=".json,application/json,.md,.markdown,text/markdown"
							onchange={importNotes}
						/>
					</label>
				</div>
			</section>

			{#if notesStore.undoable}
				<p class="notice" role="status">
					{notesStore.undoable.label}
					<button type="button" onclick={() => notesStore.undo()}>Undo</button>
				</p>
			{/if}
			{#if importError}<p class="notice" role="alert">{importError}</p>{/if}
			{#if notesStore.storageBroken}
				<p class="notice" role="alert">
					This browser refused to save. Your notes work in this tab but won't survive a reload —
					export them to keep them.
				</p>
			{/if}
		</aside>
	</div>

	<details class="help">
		<summary>Controls</summary>
		<div class="help-columns">
			<section>
				<h3>In VR, Touch controllers</h3>
				<dl>
					<dt>Left stick</dt>
					<dd>Walk where you look</dd>
					<dt>Right stick forward, release</dt>
					<dd>Teleport — onto the miniature to step into it at 1:1</dd>
					<dt>Right stick left / right</dt>
					<dd>Turn</dd>
					<dt>A / B</dt>
					<dd>Next / previous view</dd>
					<dt>X</dt>
					<dd>Note where the right hand points</dd>
					<dt>Y</dt>
					<dd>Menu: scale, views, notes, exit</dd>
					<dt>One grip</dt>
					<dd>Grab the world and pull yourself along</dd>
					<dt>Both grips</dt>
					<dd>Scale and turn the model</dd>
					<dt>Trigger</dt>
					<dd>Press menu buttons, keys, or a note to edit it</dd>
				</dl>
			</section>
			<section>
				<h3>On a screen</h3>
				<dl>
					<dt>Drag</dt>
					<dd>Orbit</dd>
					<dt>Right-drag, arrow keys</dt>
					<dd>Pan</dd>
					<dt>Scroll</dt>
					<dd>Zoom</dd>
					<dt>A view's name</dt>
					<dd>Look from it</dd>
				</dl>
			</section>
		</div>
	</details>

	<WhatsNew />
</main>

<style>
	main {
		max-width: 80rem;
		margin: 0 auto;
		padding: 1.5rem 1rem 2rem;
	}

	header {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0 1rem;
	}

	h1 {
		margin: 0;
	}

	.lede {
		margin: 0;
	}

	h2,
	h3 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
	}

	.model-name {
		overflow-wrap: anywhere;
		font-size: 1.125rem;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	button,
	.button {
		display: inline-flex;
		align-items: center;
		font: inherit;
		padding: 0.5rem 1rem;
		border: 1px solid var(--ink);
		background: var(--paper);
		color: var(--ink);
		cursor: pointer;
	}

	.primary,
	.vr:not(:disabled) {
		background: var(--ink);
		color: var(--paper);
	}

	button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	button[aria-pressed='true'] {
		background: var(--ink);
		color: var(--paper);
	}

	/* Visually hidden, not display:none — still focusable, still fires change. */
	.button input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(100%);
	}

	.button:focus-within {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.layout {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
	}

	@media (min-width: 60rem) {
		.layout {
			grid-template-columns: 1fr 22rem;
		}
	}

	.viewport {
		position: relative;
		height: max(20rem, 65svh);
		border: 1px solid var(--ink);
		overflow: hidden;
	}

	/* The canvas is made by three.js, not by this component. */
	.viewport :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
		touch-action: none;
	}

	.viewport :global(canvas.placing) {
		cursor: crosshair;
	}

	.loading {
		margin: 1rem;
	}

	aside section {
		margin-bottom: 1.5rem;
	}

	ol,
	ul {
		list-style: none;
		margin: 0 0 0.75rem;
		padding: 0;
	}

	li {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		border-bottom: 1px solid var(--ink);
		padding-block: 0.25rem;
	}

	.go {
		flex: 1;
		justify-content: flex-start;
		border: none;
		padding-inline: 0.25rem;
		text-align: left;
	}

	.current .go {
		font-weight: 700;
	}

	.small-button {
		padding: 0.125rem 0.5rem;
		font-size: 0.875rem;
	}

	.note-text {
		flex: 1;
		min-width: 0;
		font: inherit;
		padding: 0.25rem;
		border: 1px solid transparent;
		background: var(--paper);
		color: var(--ink);
	}

	.note-text:hover,
	.note-text:focus {
		border-color: var(--ink);
	}

	.done {
		text-decoration: line-through;
		opacity: 0.6;
	}

	.io {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.notice {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		margin: 0.75rem 0 0;
		padding: 0.5rem 0.75rem;
		border: 1px dashed var(--ink);
	}

	.notice button {
		padding: 0.25rem 0.75rem;
	}

	.quiet {
		opacity: 0.7;
	}

	.small {
		font-size: 0.875rem;
		margin: 0.5rem 0;
	}

	.help {
		margin-top: 1.5rem;
	}

	summary {
		cursor: pointer;
		font-weight: 600;
	}

	.help-columns {
		display: grid;
		gap: 1rem;
		margin-top: 1rem;
	}

	@media (min-width: 48rem) {
		.help-columns {
			grid-template-columns: 1fr 1fr;
		}
	}

	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.25rem 1rem;
		margin: 0;
	}

	dt {
		font-weight: 600;
	}

	dd {
		margin: 0;
	}
</style>
