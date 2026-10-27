import { LoadingManager, type Object3D, type WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { allowOwnBlobWorkers } from '$lib/trusted-types';
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

/**
 * `renderer` is needed only to ask which compressed texture formats the GPU
 * takes, so KTX2 textures are transcoded to one it can use.
 */
export async function loadFiles(files: File[], renderer: WebGLRenderer): Promise<LoadedModel> {
	const main = pickMain(files);
	if (!main) {
		const skp = files.some((f) => extension(f.name) === 'skp');
		throw new Error(
			skp
				? 'SketchUp files can’t be opened directly. In SketchUp, use File → Export → 3D Model and choose COLLADA (.dae) or glTF (.glb).'
				: 'Choose a .glb, .gltf, .fbx, .dae or .obj file (with its textures, if it has any).'
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
	} else if (format === 'fbx') {
		root = new FBXLoader(manager).parse(await file.arrayBuffer(), '');
		// FBX counts in centimetres unless its UnitScaleFactor says otherwise
		// (100 = metres). three.js reads the factor but leaves applying it to
		// the app; without this, most FBX files open a hundred times too big.
		const cmPerUnit = Number(root.userData.unitScaleFactor ?? 1) || 1;
		root.scale.multiplyScalar(cmPerUnit / 100);
	} else if (format === 'obj') {
		root = await parseOBJ(await file.text(), files, manager);
	} else {
		root = await parseGLTF(file, format, manager, renderer);
	}
	return {
		root,
		name: file.name,
		key: modelKey(file.name, file.size),
		views: camerasIn(root),
		missing: [...missing]
	};
}

/*
 * Compressed glTF — Draco and Meshopt geometry, KTX2 textures — through
 * three.js's own decoders. Draco and Basis are WebAssembly fetched from
 * /decoders/ (copied there at install, scripts/decoders.sh) and run in
 * Workers; Meshopt's is inlined. The decoders use the default loading
 * manager, not the model's, so their own files are never mistaken for
 * missing parts of the model.
 */
async function parseGLTF(
	file: File,
	format: 'glb' | 'gltf',
	manager: LoadingManager,
	renderer: WebGLRenderer
): Promise<Object3D> {
	allowOwnBlobWorkers();
	const draco = new DRACOLoader().setDecoderPath('/decoders/draco/');
	const ktx2 = new KTX2Loader().setTranscoderPath('/decoders/basis/').detectSupport(renderer);
	const loader = new GLTFLoader(manager)
		.setDRACOLoader(draco)
		.setKTX2Loader(ktx2)
		.setMeshoptDecoder(MeshoptDecoder);
	const data = format === 'glb' ? await file.arrayBuffer() : await file.text();
	try {
		return (await loader.parseAsync(data, '')).scene;
	} catch (err) {
		throw new Error(explainGLTF(err), { cause: err });
	} finally {
		// Each holds a pool of Workers; a model is opened once, so let them go.
		draco.dispose();
		ktx2.dispose();
	}
}

/** OBJ, with its materials if the .mtl it names was picked alongside. */
async function parseOBJ(text: string, files: File[], manager: LoadingManager): Promise<Object3D> {
	const loader = new OBJLoader(manager);
	const named = text.match(/^\s*mtllib\s+(.+?)\s*$/m)?.[1];
	const mtl = named
		? files.find((f) => resourceKey(f.name) === resourceKey(named))
		: files.find((f) => extension(f.name) === 'mtl');
	if (mtl) {
		const materials = new MTLLoader(manager).parse(await mtl.text(), '');
		materials.preload();
		loader.setMaterials(materials);
	}
	return loader.parse(text);
}

function explainGLTF(err: unknown): string {
	const message = err instanceof Error ? err.message : String(err);
	if (/draco|meshopt|ktx2|basisu|transcoder|decoder/i.test(message)) {
		return `Couldn’t decompress this glTF (${message}). Try exporting it again without compression.`;
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
