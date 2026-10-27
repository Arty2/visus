import { LoadingManager, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { modelKey } from '$lib/store/notes';
import { extension, isImage, pickMain, resourceKey } from './files';
import { camerasIn, type ViewTarget } from './views';

export interface LoadedModel {
	root: Object3D;
	name: string;
	/** What the model's notes are filed under — see store/notes.ts. */
	key: string;
	views: ViewTarget[];
	/** Files the model asked for that weren't picked with it. */
	missing: string[];
}

// One transparent pixel, handed back for a texture that wasn't picked: the
// model still loads, untextured where the file is missing, and the page
// lists what to add instead of the console filling with 404s.
const BLANK =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

let live: string[] = [];

export async function loadFiles(files: File[]): Promise<LoadedModel> {
	const main = pickMain(files);
	if (!main) {
		const skp = files.some((f) => extension(f.name) === 'skp');
		throw new Error(
			skp
				? 'SketchUp files can’t be opened directly. In SketchUp, use File → Export → 3D Model and choose COLLADA (.dae) or glTF (.glb).'
				: 'Choose a .glb, .gltf or .dae file (with its textures, if it has any).'
		);
	}

	// Object URLs from the last model are let go only now, once a new one is
	// on its way: textures in a .dae keep loading after parse() returns.
	for (const url of live) URL.revokeObjectURL(url);
	live = [];

	const byName = new Map<string, string>();
	for (const file of files) {
		if (file === main.file) continue;
		const url = URL.createObjectURL(file);
		live.push(url);
		byName.set(resourceKey(file.name), url);
	}

	const missing = new Set<string>();
	const manager = new LoadingManager();
	manager.setURLModifier((url) => {
		// glTF hands embedded images over as blob: or data: URLs of its own.
		if (/^(blob|data):/.test(url)) return url;
		const key = resourceKey(url);
		const found = byName.get(key);
		if (found) return found;
		missing.add(key);
		return isImage(key) ? BLANK : url;
	});

	const { file, format } = main;
	let root: Object3D;

	if (format === 'dae') {
		root = await parseCollada(await file.text(), manager);
	} else {
		const loader = new GLTFLoader(manager);
		const data = format === 'glb' ? await file.arrayBuffer() : await file.text();
		try {
			root = (await loader.parseAsync(data, '')).scene;
		} catch (err) {
			throw new Error(explainGLTF(err), { cause: err });
		}
	}

	return {
		root,
		name: file.name,
		key: modelKey(file.name, file.size),
		views: camerasIn(root),
		missing: [...missing]
	};
}

function explainGLTF(err: unknown): string {
	const message = err instanceof Error ? err.message : String(err);
	if (/draco|meshopt|ktx2|basisu/i.test(message)) {
		return 'This glTF uses compression visus doesn’t read yet (Draco, Meshopt or KTX2). Export it again without compression.';
	}
	return `Couldn’t read that glTF: ${message}`;
}

/*
 * ColladaLoader parses with `new DOMParser().parseFromString()`, which the
 * Content Security Policy refuses: under `require-trusted-types-for 'script'`
 * that method is a Trusted Types sink and demands a TrustedHTML, even for
 * XML. Allow-listing a policy to bless the string would be a loosening for
 * the sake of a parser. Instead the XML is parsed by XMLHttpRequest — reading
 * a blob: URL back with responseType 'document' is not a sink — and the
 * already-parsed document is handed to the loader by standing in for
 * DOMParser for the length of one synchronous call. Nothing else can run in
 * between, and the original is put back in `finally`.
 */
async function parseCollada(text: string, manager: LoadingManager): Promise<Object3D> {
	const doc = await parseXML(text);
	if (
		doc.getElementsByTagName('parsererror').length ||
		!doc.getElementsByTagName('COLLADA').length
	) {
		throw new Error('That .dae file isn’t valid COLLADA.');
	}

	const original = globalThis.DOMParser;
	class Parsed {
		parseFromString() {
			return doc;
		}
	}
	globalThis.DOMParser = Parsed as unknown as typeof DOMParser;
	try {
		const result = new ColladaLoader(manager).parse(text, '');
		if (!result) throw new Error('That .dae file isn’t valid COLLADA.');
		return result.scene;
	} finally {
		globalThis.DOMParser = original;
	}
}

function parseXML(text: string): Promise<Document> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(new Blob([text], { type: 'application/xml' }));
		const xhr = new XMLHttpRequest();
		xhr.open('GET', url);
		xhr.responseType = 'document';
		xhr.overrideMimeType('application/xml');
		xhr.onload = () => {
			URL.revokeObjectURL(url);
			if (xhr.response) resolve(xhr.response as Document);
			else reject(new Error('That .dae file isn’t valid XML.'));
		};
		xhr.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Couldn’t read that .dae file.'));
		};
		xhr.send();
	});
}
