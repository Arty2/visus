import { describe, expect, it } from 'vitest';
import { isGaussianPly, isImage, pickMain, resourceKey } from './files';

describe('pickMain', () => {
	it('finds the model among its textures, whatever order they came in', () => {
		const files = [{ name: 'wood.jpg' }, { name: 'House.DAE' }, { name: 'glass.png' }];
		expect(pickMain(files)).toEqual({ file: files[1], format: 'dae' });
	});

	it('prefers a self-contained binary glTF when given a choice', () => {
		const files = [{ name: 'a.gltf' }, { name: 'a.bin' }, { name: 'a.glb' }];
		expect(pickMain(files)?.format).toBe('glb');
	});

	it('reads OBJ and FBX, and takes an OBJ over its .mtl', () => {
		expect(pickMain([{ name: 'a.mtl' }, { name: 'a.obj' }])?.format).toBe('obj');
		expect(pickMain([{ name: 'chair.FBX' }])?.format).toBe('fbx');
	});

	it('reports nothing rather than guessing', () => {
		expect(pickMain([{ name: 'house.skp' }, { name: 'notes.md' }])).toBeNull();
	});
});

describe('isGaussianPly', () => {
	const header = (props: string) =>
		`ply\nformat binary_little_endian 1.0\nelement vertex 3\n${props}end_header\n`;

	it('knows a splat scan by its splat properties', () => {
		expect(
			isGaussianPly(
				header(
					'property float x\nproperty float f_dc_0\nproperty float opacity\nproperty float scale_0\n'
				)
			)
		).toBe(true);
	});

	it('takes anything else for a mesh, and looks only at the header', () => {
		expect(isGaussianPly(header('property float x\nproperty uchar red\n'))).toBe(false);
		expect(isGaussianPly(header('property float x\n') + 'opacity scale_0 in the body')).toBe(false);
	});
});

describe('resourceKey', () => {
	it('matches however the model spells the path', () => {
		expect(resourceKey('textures/Wood%20Floor.JPG')).toBe('wood floor.jpg');
		expect(resourceKey('./wood floor.jpg?v=2')).toBe('wood floor.jpg');
		expect(resourceKey('C:\\Models\\house\\Wood Floor.jpg')).toBe('wood floor.jpg');
		expect(resourceKey('100%.png')).toBe('100%.png');
	});
});

describe('isImage', () => {
	it('knows a texture from a buffer', () => {
		expect(isImage('a.JPEG')).toBe(true);
		expect(isImage('a.bin')).toBe(false);
	});
});
