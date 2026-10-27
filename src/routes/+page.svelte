<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { notesStore, type Incoming } from '$lib/store/notes.svelte';
	import { downloadText } from '$lib/io/download';
	import { fromJSON, toJSON } from '$lib/io/json';
	import { fromMarkdown, toMarkdown } from '$lib/io/markdown';
	import type { Viewer } from '$lib/viewer/viewer';
	import type { ViewTarget } from '$lib/viewer/views';
	import WhatsNew from '$lib/WhatsNew.svelte';
	import Icon from '$lib/Icon.svelte';
	import Tip from '$lib/Tip.svelte';
	import { Dialog, Switch, ToggleGroup, Tooltip } from 'bits-ui';
	import { BACKDROP_ORDER, BACKDROPS, isBackdrop, type Backdrop } from '$lib/viewer/backdrop';

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
	// By id, not index: deleting a saved view shifts the ones after it.
	let currentViewId: string | null = $state(null);
	let importError = $state('');
	/** Whether to optimise many-mesh models on open (optimise.ts); remembered. */
	let optimiseOn = $state(true);
	/** What optimising did to the model just opened, in a sentence. */
	let optimiseNote = $state('');
	const OPTIMISE_KEY = 'visus:optimise';

	/** What the model is seen against; white unless chosen otherwise. */
	let backdrop: Backdrop = $state('white');
	const BACKDROP_KEY = 'visus:backdrop';

	function setBackdrop(kind: Backdrop, remember = true) {
		backdrop = kind;
		viewer?.setBackdrop(kind);
		if (!remember) return;
		try {
			localStorage.setItem(BACKDROP_KEY, kind);
		} catch {
			// A preference that won't stick is no reason to interrupt anyone.
		}
	}

	function setOptimise(on: boolean) {
		optimiseOn = on;
		try {
			localStorage.setItem(OPTIMISE_KEY, on ? 'on' : 'off');
		} catch {
			// A preference that won't stick is no reason to interrupt anyone.
		}
	}
	/** The saved view whose name is being edited in place, if any. */
	let renaming: string | null = $state(null);
	let helpOpen = $state(false);
	const openNotes = $derived(notesStore.annotations.filter((a) => !a.done).length);

	// Escape leaves note-placing mode — the way out a crosshair cursor implies.
	function onKey(event: KeyboardEvent) {
		if (event.key === 'Escape' && addMode) addMode = false;
		// Ctrl/Cmd+Z steps back through every change to the notes, views and
		// sketches; with Shift (or Ctrl+Y), forward again. Not while typing:
		// a text field's own undo is the one meant there.
		const typing = (event.target as HTMLElement | null)?.closest('input, textarea');
		if (typing || !(event.ctrlKey || event.metaKey)) return;
		const key = event.key.toLowerCase();
		if (key === 'z' && !event.shiftKey) notesStore.undo();
		else if ((key === 'z' && event.shiftKey) || key === 'y') notesStore.redo();
		else return;
		event.preventDefault();
	}

	const views: ViewTarget[] = $derived([
		...fileViews,
		...notesStore.viewpoints.map((v) => ({ ...v, pitch: 0, saved: true }))
	]);
	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
	const noNotes = $derived(notesStore.annotations.length === 0);
	const currentView = $derived(views.findIndex((v) => v.id === currentViewId));

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
		try {
			optimiseOn = localStorage.getItem(OPTIMISE_KEY) !== 'off';
			const saved = localStorage.getItem(BACKDROP_KEY);
			if (isBackdrop(saved)) backdrop = saved;
		} catch {
			// Storage refused: the default stands.
		}
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
				viewChanged: (index) => (currentViewId = views[index]?.id ?? null),
				noteSelected: (id) => void focusNote(id),
				sessionChanged: (active) => (inVR = active),
				backdropChanged: (kind) => setBackdrop(kind)
			});
			created.notesById = (id) => notesStore.annotations.find((a) => a.id === id);
			created.setBackdrop(backdrop);
			viewer = created;
			// Fetched now, while the person looks at the sample, rather than on
			// their first Open: five formats and three decoders are a large
			// module, and waiting for it after choosing a file feels broken.
			void import('$lib/viewer/load');
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
		optimiseNote = '';
		fileViews = cameras;
		modelName = name;
		missing = missingFiles;
		currentViewId = null;
		addMode = false;
		notesStore.open(key);
	}

	async function openFiles(files: File[], remember: boolean) {
		if (!files.length || !viewer) return;
		loading = true;
		loadError = '';
		try {
			const [{ loadFiles }, { rememberFiles }] = await Promise.all([
				import('$lib/viewer/load'),
				import('$lib/viewer/recent')
			]);
			const model = await loadFiles(files, viewer.gl, { optimise: optimiseOn });
			show(model.root, model.name, model.key, model.views, model.missing);
			const n = (x: number) => x.toLocaleString();
			optimiseNote = model.optimised
				? `Optimised for VR: ${n(model.optimised.before.meshes)} meshes drawn as ${n(model.optimised.after.meshes)}.`
				: model.optimiseError
					? `Shown as exported — optimising failed (${model.optimiseError}).`
					: '';
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
			toJSON(notesStore.snapshot(), modelName, notesStore.encoded())
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
			const incoming: Incoming = looksLikeJSON
				? fromJSON(text)
				: { notes: { annotations: fromMarkdown(text), viewpoints: [], sketches: [] } };
			const { annotations, viewpoints, sketches } = incoming.notes;
			// One refusal for every format: a file with nothing in it is almost
			// always the wrong file — a README reads as no notes at all.
			if (annotations.length + viewpoints.length + sketches.length === 0) {
				throw new Error('That file contains no notes.');
			}
			// Merged, never replaced: see notesStore.merge().
			notesStore.merge(incoming, file.name);
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

<svelte:window onkeydown={onKey} />

<Tooltip.Provider>
	<div class="app">
		<header class="topbar">
			<div class="brand">
				<span class="mark" aria-hidden="true"><Icon name="cube" size={22} /></span>
				<div>
					<h1>visus</h1>
					<p class="tagline">Walk through a 3D model in a Meta Quest, and leave notes in it.</p>
				</div>
			</div>

			<div class="actions">
				<!-- No `accept` filter, on purpose: Android-based browsers, the Quest's
			     among them, match it by MIME type, and .glb and .dae have none they
			     recognise — the files show greyed out and can't be picked. What
			     was picked is checked after (src/lib/viewer/files.ts). -->
				<!-- Disabled until the viewer is up: a model opened sooner had nowhere
			     to go, and the sample loading next silently replaced it. -->
				<label class="btn" class:disabled={!viewer}>
					<Icon name="open" />
					<span>Open model…</span>
					<input
						bind:this={modelInput}
						type="file"
						multiple
						disabled={!viewer}
						onchange={(e) => openFiles([...(e.currentTarget.files ?? [])], true)}
					/>
				</label>
				{#if recentName && recentName !== modelName}
					<button type="button" class="btn" onclick={reopen}>
						<Icon name="history" />
						<span>Reopen {recentName}</span>
					</button>
				{/if}
				<button type="button" class="btn" onclick={openSample} disabled={!viewer}>
					<Icon name="cube" />
					<span>Sample</span>
				</button>
				<button
					type="button"
					class="btn primary"
					onclick={enterVR}
					disabled={!viewer || !xrSupported || inVR}
					aria-describedby="vr-hint"
				>
					<Icon name="vr" />
					<span>Enter VR</span>
				</button>
			</div>
		</header>

		<main class="workspace">
			<section class="stage" aria-label="Model">
				<div class="viewport" class:placing={addMode} bind:this={container}>
					{#if !viewer}<p class="loading">Loading the viewer…</p>{/if}
				</div>

				<div class="hud top">
					<div class="chip">
						<span class="dot" class:live={inVR}></span>
						<span class="chip-title">{modelName || 'No model'}</span>
						<span class="chip-meta"
							>{plural(views.length, 'view')} · {plural(
								notesStore.annotations.length,
								'note'
							)}</span
						>
					</div>
					<p id="vr-hint" class="chip quiet">
						{#if inVR}
							In VR — take the headset off any time; notes stay in step.
						{:else if xrSupported === false}
							VR needs the Meta Quest Browser. Everything else works here.
						{:else}
							Ready for VR
						{/if}
					</p>
				</div>

				<div class="hud bottom">
					{#if addMode}
						<p class="chip note-chip" role="status">
							<Icon name="pin" size={18} /> Click the model to place a note · <kbd>Esc</kbd> to cancel
						</p>
					{:else if views[currentView]}
						<p class="chip">
							<Icon name="camera" size={18} />
							{views[currentView].name}
							<span class="chip-meta">{currentView + 1} / {views.length}</span>
						</p>
					{:else}
						<span></span>
					{/if}

					<ToggleGroup.Root
						type="single"
						class="backdrops"
						aria-label="Background"
						value={backdrop}
						onValueChange={(kind) => {
							// A single-choice group can be emptied by pressing the chosen
							// item again; a background always has to be one of them.
							if (isBackdrop(kind)) setBackdrop(kind);
						}}
					>
						{#each BACKDROP_ORDER as kind (kind)}
							<Tip label={BACKDROPS[kind].label}>
								{#snippet children(props)}
									<ToggleGroup.Item
										{...props}
										value={kind}
										class="backdrop"
										aria-label={`${BACKDROPS[kind].label} background`}
									>
										<Icon name={BACKDROPS[kind].icon} size={18} />
									</ToggleGroup.Item>
								{/snippet}
							</Tip>
						{/each}
					</ToggleGroup.Root>
				</div>
			</section>

			<aside class="sidebar">
				{#if loading || loadError || xrError || missing.length || optimiseNote}
					<div class="stack">
						{#if loading}<p class="notice" role="status">Opening…</p>{/if}
						{#if optimiseNote}<p class="notice" role="status">{optimiseNote}</p>{/if}
						{#if loadError}<p class="notice error" role="alert">{loadError}</p>{/if}
						{#if xrError}<p class="notice error" role="alert">{xrError}</p>{/if}
						{#if missing.length}
							<p class="notice" role="status">
								Shown without {missing.length === 1 ? 'a file' : `${missing.length} files`} it refers
								to — open them together with the model: {missing.join(', ')}
							</p>
						{/if}
					</div>
				{/if}

				<section class="card" aria-labelledby="views-title">
					<header class="card-head">
						<span class="card-icon"><Icon name="camera" /></span>
						<h2 id="views-title">Views</h2>
						<span class="count">{views.length}</span>
					</header>

					{#if views.length}
						<ol class="list">
							{#each views as view, i (view.id)}
								<li class="row" class:current={i === currentView}>
									<span class="index">{String(i + 1).padStart(2, '0')}</span>
									{#if renaming === view.id}
										<!-- svelte-ignore a11y_autofocus -->
										<input
											class="field"
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
									{#if view.saved}
										{#if renaming !== view.id}
											<Tip label="Rename">
												{#snippet children(props)}
													<button
														{...props}
														type="button"
														class="icon-btn"
														aria-label={`Rename ${view.name}`}
														onclick={() => (renaming = view.id)}
														><Icon name="pencil" size={18} /></button
													>
												{/snippet}
											</Tip>
										{/if}
										<Tip label="Delete">
											{#snippet children(props)}
												<button
													{...props}
													type="button"
													class="icon-btn"
													aria-label={`Delete ${view.name}`}
													onclick={() => notesStore.removeViewpoint(view.id)}
													><Icon name="trash" size={18} /></button
												>
											{/snippet}
										</Tip>
									{:else}
										<span class="tag">file</span>
									{/if}
								</li>
							{/each}
						</ol>
					{:else}
						<p class="empty">No cameras in this model yet.</p>
					{/if}

					<div class="card-foot">
						<button
							type="button"
							class="btn wide"
							onclick={saveDesktopView}
							disabled={!viewer || !modelName}
						>
							<Icon name="bookmark" />
							<span>Save this view</span>
						</button>
					</div>
				</section>

				<section class="card" aria-labelledby="notes-title">
					<header class="card-head">
						<span class="card-icon note"><Icon name="pin" /></span>
						<h2 id="notes-title">Notes</h2>
						<span class="count">{openNotes} open</span>
					</header>

					{#if noNotes}
						<p class="empty">None yet. Add one here, or with X in VR.</p>
					{:else}
						<ul class="list">
							{#each notesStore.annotations as note, i (note.id)}
								<li class="row">
									<span class="index note">{String(i + 1).padStart(2, '0')}</span>
									<input
										type="checkbox"
										class="check"
										checked={note.done}
										aria-label={`Resolved: note ${i + 1}`}
										onchange={() => notesStore.toggle(note.id)}
									/>
									<input
										id={`note-${note.id}`}
										class="field note-text"
										class:done={note.done}
										value={note.text}
										placeholder="Write a note…"
										aria-label={`Note ${i + 1}`}
										onchange={(e) => notesStore.setText(note.id, e.currentTarget.value.trim())}
									/>
									<Tip label="Delete">
										{#snippet children(props)}
											<button
												{...props}
												type="button"
												class="icon-btn"
												aria-label={`Delete note ${i + 1}`}
												onclick={() => notesStore.removeAnnotation(note.id)}
												><Icon name="trash" size={18} /></button
											>
										{/snippet}
									</Tip>
								</li>
							{/each}
						</ul>
					{/if}

					<div class="card-foot">
						<button
							type="button"
							class="btn wide"
							class:armed={addMode}
							aria-pressed={addMode}
							onclick={() => (addMode = !addMode)}
							disabled={!viewer || !modelName}
						>
							<Icon name="plus" />
							<span>Add note</span>
						</button>
						<div class="trio">
							<button type="button" class="btn small" onclick={exportMarkdown} disabled={noNotes}>
								<Icon name="download" size={18} />
								<span><span class="sr">Export </span>Markdown</span>
							</button>
							<button
								type="button"
								class="btn small"
								onclick={exportJSON}
								disabled={noNotes && !notesStore.viewpoints.length}
							>
								<Icon name="download" size={18} />
								<span><span class="sr">Export </span>JSON</span>
							</button>
							<label class="btn small">
								<Icon name="upload" size={18} />
								<span>Import</span>
								<input
									bind:this={notesInput}
									aria-label="Import notes"
									type="file"
									accept=".json,application/json,.md,.markdown,text/markdown"
									onchange={importNotes}
								/>
							</label>
						</div>
					</div>
				</section>

				{#if notesStore.undoable || importError || notesStore.storageBroken}
					<div class="stack">
						{#if notesStore.undoable}
							<p class="notice" role="status">
								<span>{notesStore.undoable.label}</span>
								<button type="button" class="btn small" onclick={() => notesStore.undo()}
									>Undo</button
								>
							</p>
						{/if}
						{#if importError}<p class="notice error" role="alert">{importError}</p>{/if}
						{#if notesStore.storageBroken}
							<p class="notice error" role="alert">
								This browser refused to save. Your notes work in this tab but won't survive a reload
								— export them to keep them.
							</p>
						{/if}
					</div>
				{/if}
			</aside>
		</main>

		<footer class="footbar">
			<button type="button" class="link" onclick={() => (helpOpen = true)} aria-haspopup="dialog">
				<Icon name="help" size={18} />
				<span>Controls</span>
			</button>
			<span class="switch">
				<Switch.Root
					id="optimise"
					class="switch-track"
					checked={optimiseOn}
					onCheckedChange={setOptimise}
				>
					<Switch.Thumb class="switch-thumb" />
				</Switch.Root>
				<label for="optimise">Optimise large models</label>
			</span>
			<WhatsNew />
		</footer>
	</div>
</Tooltip.Provider>

<Dialog.Root bind:open={helpOpen}>
	<Dialog.Portal>
		<Dialog.Overlay class="overlay" />
		<Dialog.Content class="dialog help">
			<div class="dialog-head">
				<Dialog.Title class="dialog-title">Controls</Dialog.Title>
				<Dialog.Close class="icon-btn" aria-label="Close"><Icon name="close" /></Dialog.Close>
			</div>
			<div class="help-columns">
				<section>
					<h3><Icon name="vr" size={18} /> In VR, Touch controllers</h3>
					<dl>
						<dt><kbd>L</kbd> stick</dt>
						<dd>Walk where you look</dd>
						<dt><kbd>R</kbd> stick ↑, release</dt>
						<dd>Teleport — onto the miniature to step into it at 1:1</dd>
						<dt><kbd>R</kbd> stick ← →</dt>
						<dd>Turn</dd>
						<dt><kbd>A</kbd> <kbd>B</kbd></dt>
						<dd>Next / previous view</dd>
						<dt><kbd>X</kbd></dt>
						<dd>Note where the right hand points</dd>
						<dt><kbd>Y</kbd></dt>
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
					<h3><Icon name="cube" size={18} /> On a screen</h3>
					<dl>
						<dt>Drag, <kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd></dt>
						<dd>Orbit</dd>
						<dt>Right-drag, <kbd>⇧</kbd> + arrows</dt>
						<dd>Pan</dd>
						<dt>Scroll, <kbd>+</kbd><kbd>−</kbd></dt>
						<dd>Zoom, toward the pointer</dd>
						<dt>A view's name</dt>
						<dd>Fly to it</dd>
						<dt>Add note</dt>
						<dd>Then click the model; <kbd>Esc</kbd> cancels</dd>
					</dl>
				</section>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	/* minmax(0, …) everywhere a track holds text: an `auto` track grows to
	   its widest unbreakable line, and on a phone that's a sideways scroll. */
	.app {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto 1fr auto;
		min-height: 100svh;
		max-width: 110rem;
		margin: 0 auto;
		padding: 1rem clamp(1rem, 2.5vw, 2rem);
		gap: 1rem;
	}

	/* ── Top bar: brand on the left, actions on the right ─────────────── */

	.topbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem 2rem;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.875rem;
	}

	.mark {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 13px;
		color: var(--accent-ink);
		background: linear-gradient(135deg, #ffb27a, var(--accent) 55%, #e2600c);
		box-shadow:
			0 0 0 1px rgba(255, 131, 43, 0.45),
			0 8px 28px rgba(255, 131, 43, 0.28);
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		line-height: 1.1;
	}

	.tagline {
		margin: 0.15rem 0 0;
		color: var(--text-dim);
		font-size: 0.9rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.625rem;
	}

	/* ── Buttons: one shape, three weights ─────────────────────────────── */

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: var(--control);
		padding: 0 1.1rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text);
		font: inherit;
		font-size: 0.95rem;
		font-weight: 550;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background-color 120ms ease,
			border-color 120ms ease,
			box-shadow 120ms ease;
	}

	.btn:hover:not(:disabled) {
		background: var(--surface-hover);
		border-color: #3b4a5b;
	}

	.btn.primary {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-ink);
		box-shadow: 0 6px 24px rgba(255, 131, 43, 0.24);
	}

	.btn.primary:hover:not(:disabled) {
		background: #ff9a52;
		border-color: #ff9a52;
	}

	.btn:disabled,
	.btn.disabled {
		opacity: 0.4;
		cursor: default;
		box-shadow: none;
	}

	.btn.small {
		min-height: 2.5rem;
		padding: 0 0.75rem;
		font-size: 0.85rem;
	}

	.btn.wide {
		width: 100%;
	}

	.btn.armed {
		background: var(--note-soft);
		border-color: var(--note);
		color: var(--note);
	}

	/* A file input is visually hidden, not display:none — it still takes
	   focus and fires change for keyboard and screen-reader use. */
	.btn input[type='file'] {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(100%);
	}

	.btn:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.link {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.25rem 0;
		border: none;
		background: none;
		color: var(--text-dim);
		font: inherit;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.link:hover {
		color: var(--text);
	}

	/* ── Workspace: the stage, and a sidebar of two matching cards ──────── */

	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 1rem;
		min-height: 0;
	}

	@media (min-width: 64rem) {
		.workspace {
			grid-template-columns: minmax(0, 1fr) 25rem;
			height: calc(100svh - 10.5rem);
			min-height: 34rem;
		}

		.sidebar {
			overflow-y: auto;
			padding-right: 0.25rem;
		}
	}

	.stage {
		position: relative;
		min-height: max(22rem, 62svh);
		border: 1px solid var(--line);
		border-radius: calc(var(--radius) + 4px);
		overflow: hidden;
		/* White like the default background, so the frame before the first
		   render doesn't flash dark. */
		background: #ffffff;
		box-shadow:
			inset 0 0 0 1px rgba(255, 255, 255, 0.02),
			0 30px 80px rgba(0, 0, 0, 0.45);
	}

	@media (min-width: 64rem) {
		.stage {
			min-height: 0;
		}
	}

	.viewport {
		position: absolute;
		inset: 0;
	}

	/* The canvas is made by three.js, not by this component. */
	.viewport :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
		touch-action: none;
	}

	.viewport.placing :global(canvas) {
		cursor: crosshair;
	}

	.loading {
		margin: 1.25rem;
		color: var(--text-dim);
	}

	/* Heads-up chips over the canvas: they don't take the pointer, so
	   orbiting works right up to their edges. */
	.hud {
		position: absolute;
		left: 1rem;
		right: 1rem;
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.5rem;
		margin: 0;
		pointer-events: none;
	}

	.hud.top {
		top: 1rem;
	}

	.hud.bottom {
		bottom: 1rem;
		align-items: flex-end;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		margin: 0;
		padding: 0.5rem 0.9rem;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		background: rgba(9, 12, 16, 0.82);
		font-size: 0.875rem;
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35);
	}

	.chip.quiet {
		color: var(--text-dim);
	}

	.chip-title {
		font-weight: 600;
		max-width: 22ch;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chip-meta {
		color: var(--text-dim);
		font-family: var(--mono);
		font-size: 0.8rem;
	}

	.note-chip {
		border-color: var(--note);
		color: var(--note);
	}

	.dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 10px var(--accent);
	}

	.dot.live {
		background: var(--note);
		box-shadow: 0 0 12px var(--note);
	}

	@media (prefers-reduced-motion: no-preference) {
		.dot.live {
			animation: pulse 1.6s ease-in-out infinite;
		}
	}

	@keyframes pulse {
		50% {
			opacity: 0.35;
		}
	}

	kbd {
		display: inline-grid;
		place-items: center;
		min-width: 1.6em;
		padding: 0 0.35em;
		border: 1px solid var(--line-strong);
		border-bottom-width: 2px;
		border-radius: 6px;
		background: var(--surface);
		color: var(--text);
		font-family: var(--mono);
		font-size: 0.8em;
		line-height: 1.5;
	}

	/* ── Cards ─────────────────────────────────────────────────────────── */

	.sidebar {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-height: 0;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		padding: 1.1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent 40%), var(--panel);
	}

	.card-head {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.card-icon {
		display: grid;
		place-items: center;
		width: 2.1rem;
		height: 2.1rem;
		border-radius: 10px;
		background: var(--accent-soft);
		color: var(--accent);
	}

	.card-icon.note {
		background: var(--note-soft);
		color: var(--note);
	}

	h2 {
		flex: 1;
		margin: 0;
		font-size: 1.05rem;
		font-weight: 650;
		letter-spacing: 0.01em;
	}

	.count {
		padding: 0.15rem 0.6rem;
		border: 1px solid var(--line-strong);
		border-radius: 999px;
		color: var(--text-dim);
		font-family: var(--mono);
		font-size: 0.8rem;
	}

	.card-foot {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.trio {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
	}

	.trio .btn {
		flex-direction: column;
		gap: 0.2rem;
		min-height: 3.75rem;
		padding: 0.4rem;
		white-space: normal;
		text-align: center;
		line-height: 1.15;
	}

	/* Read aloud, not shown: the icon already says "export" on screen. */
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(100%);
		white-space: nowrap;
	}

	.empty {
		margin: 0;
		padding: 1rem;
		border: 1px dashed var(--line-strong);
		border-radius: var(--radius-sm);
		color: var(--text-dim);
		font-size: 0.9rem;
		text-align: center;
	}

	/* ── Rows: index, content, actions ─────────────────────────────────── */

	.list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 3rem;
		padding: 0.3rem 0.4rem 0.3rem 0.55rem;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: var(--surface);
	}

	.row:hover {
		border-color: var(--line-strong);
	}

	.row.current {
		border-color: var(--accent-line);
		background: var(--accent-soft);
	}

	.index {
		flex: none;
		width: 1.9rem;
		color: var(--accent);
		font-family: var(--mono);
		font-size: 0.8rem;
		font-weight: 600;
	}

	.index.note {
		color: var(--note);
	}

	.go {
		flex: 1;
		min-width: 0;
		min-height: 2.25rem;
		padding: 0 0.25rem;
		border: none;
		background: none;
		color: var(--text);
		font: inherit;
		font-size: 0.95rem;
		text-align: left;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: pointer;
	}

	.current .go {
		color: var(--accent);
		font-weight: 650;
	}

	.tag {
		flex: none;
		padding: 0.1rem 0.5rem;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.05);
		color: var(--text-dim);
		font-family: var(--mono);
		font-size: 0.72rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.field {
		flex: 1;
		min-width: 0;
		min-height: 2.25rem;
		padding: 0 0.5rem;
		border: 1px solid transparent;
		border-radius: 8px;
		background: transparent;
		color: var(--text);
		font: inherit;
		font-size: 0.95rem;
	}

	.field::placeholder {
		color: var(--text-faint);
	}

	.field:hover {
		border-color: var(--line-strong);
	}

	.field:focus {
		outline: none;
		border-color: var(--accent);
		background: var(--bg);
	}

	.field.done {
		color: var(--text-dim);
		text-decoration: line-through;
	}

	/* A drawn checkbox, in the notes' amber. The tick is a data: SVG, which
	   img-src already allows — it's a picture, not a script. */
	.check {
		appearance: none;
		flex: none;
		width: 1.25rem;
		height: 1.25rem;
		margin: 0;
		border: 1.5px solid var(--line-strong);
		border-radius: 6px;
		background: var(--bg) center / 80% no-repeat;
		cursor: pointer;
	}

	.check:hover {
		border-color: var(--note);
	}

	.check:checked {
		border-color: var(--note);
		background-color: var(--note);
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2307090c' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 12.5l4.5 4.5L19 7.5'/%3E%3C/svg%3E");
	}

	/* ── Notices ───────────────────────────────────────────────────────── */

	.stack {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.notice {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		margin: 0;
		padding: 0.7rem 0.9rem;
		border: 1px solid var(--accent-line);
		border-left-width: 3px;
		border-radius: var(--radius-sm);
		background: var(--accent-soft);
		font-size: 0.9rem;
		overflow-wrap: anywhere;
	}

	.notice.error {
		border-color: rgba(255, 122, 122, 0.5);
		background: var(--danger-soft);
	}

	/* ── Footer, and the controls dialog ───────────────────────────────── */

	.footbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		color: var(--text-dim);
	}

	.switch {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		margin-right: auto;
		margin-left: 1.5rem;
		color: var(--text-dim);
		font-size: 0.9rem;
		cursor: pointer;
	}

	.footbar :global(.credit) {
		margin: 0;
	}

	.dialog-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}

	.help-columns {
		display: grid;
		gap: 1rem;
	}

	@media (min-width: 48rem) {
		.help-columns {
			grid-template-columns: 1fr 1fr;
		}
	}

	.help-columns section {
		padding: 1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		background: var(--surface);
	}

	h3 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0 0 0.75rem;
		color: var(--accent);
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.55rem 1rem;
		margin: 0;
		font-size: 0.92rem;
	}

	dt {
		font-weight: 600;
		white-space: nowrap;
	}

	dd {
		margin: 0;
		color: var(--text-dim);
	}
</style>
