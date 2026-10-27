import { describe, expect, it } from 'vitest';
import { newAnnotation, newViewpoint } from '$lib/store/notes';
import { fromJSON, toJSON } from './json';

describe('toJSON / fromJSON', () => {
	it('round-trips notes and viewpoints', () => {
		const notes = {
			annotations: [
				newAnnotation('a', [1, 2, 3]),
				{ ...newAnnotation('b', [0, 0, 0]), done: true }
			],
			viewpoints: [newViewpoint('Hall', [0, 1.6, 0], 1)]
		};
		expect(fromJSON(toJSON(notes, 'house.dae'))).toEqual(notes);
	});

	it('rejects text that is not JSON', () => {
		expect(() => fromJSON('not json')).toThrow(/not valid JSON/);
	});

	it('rejects JSON that is not a set of notes', () => {
		expect(() => fromJSON('null')).toThrow(/not a recognised set of notes/);
		expect(() => fromJSON('{"annotations":[{"foo":1}]}')).toThrow(/not a recognised/);
		expect(() => fromJSON('{"viewpoints":"x"}')).toThrow(/not a recognised/);
	});

	// Empty is a valid reading; refusing to apply it is the page's call.
	it('reads an empty set as empty, not as an error', () => {
		expect(fromJSON('{}')).toEqual({ annotations: [], viewpoints: [] });
	});
});
