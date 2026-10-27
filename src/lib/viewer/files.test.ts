import { describe, expect, it } from 'vitest';
import { isImage, pickMain, resourceKey } from './files';

describe('pickMain', () => {
	it('finds the model among its textures, whatever order they came in', () => {
		const files = [{ name: 'wood.jpg' }, { name: 'House.DAE' }, { name: 'glass.png' }];
		expect(pickMain(files)).toEqual({ file: files[1], format: 'dae' });
	});

	it('prefers a self-contained binary glTF when given a choice', () => {
		const files = [{ name: 'a.gltf' }, { name: 'a.bin' }, { name: 'a.glb' }];
		expect(pickMain(files)?.format).toBe('glb');
	});

	it('reports nothing rather than guessing', () => {
		expect(pickMain([{ name: 'house.skp' }, { name: 'notes.md' }])).toBeNull();
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
