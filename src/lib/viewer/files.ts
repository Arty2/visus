// Which of the files someone picked is the model, and how the others are
// found again when the model asks for them. A model is often more than one
// file — a .gltf with its .bin and textures, a SketchUp .dae with a folder of
// images — and the browser hands them over flat, folders gone.

export type Format = 'glb' | 'gltf' | 'dae';

// Preferred in this order when several are picked together: binary glTF is
// self-contained, so it's the least likely to be missing a part.
const FORMATS: Format[] = ['glb', 'gltf', 'dae'];

export const ACCEPT = '.glb,.gltf,.dae,.bin,.png,.jpg,.jpeg,.webp,.tga,.bmp,.gif';

export function extension(name: string): string {
	const dot = name.lastIndexOf('.');
	return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

export function pickMain<T extends { name: string }>(
	files: T[]
): { file: T; format: Format } | null {
	for (const format of FORMATS) {
		const file = files.find((f) => extension(f.name) === format);
		if (file) return { file, format };
	}
	return null;
}

/**
 * The key a requested resource is looked up by: its last path segment,
 * decoded and lower-cased. `textures/Wood%20Floor.JPG`, `./wood floor.jpg`
 * and `C:\\models\\wood floor.jpg` (SketchUp writes Windows paths into .dae
 * files) all find the one file called `Wood Floor.jpg`.
 */
export function resourceKey(url: string): string {
	let path = url.split(/[?#]/)[0];
	try {
		path = decodeURIComponent(path);
	} catch {
		// A lone % in a file name: use it as written.
	}
	const segments = path.split(/[\\/]/);
	return (segments[segments.length - 1] ?? '').toLowerCase();
}

const IMAGE = new Set(['png', 'jpg', 'jpeg', 'webp', 'tga', 'bmp', 'gif']);

export function isImage(name: string): boolean {
	return IMAGE.has(extension(name));
}
