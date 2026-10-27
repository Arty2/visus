import { describe, expect, it } from 'vitest';
import { newAnnotation, newSketch, newViewpoint } from '$lib/store/notes';
import { fromJSON, toJSON } from './json';

describe('toJSON / fromJSON', () => {
	it('round-trips notes, viewpoints, sketches and the Yjs state', () => {
		const notes = {
			// Distinct times: two made in one millisecond would sort by id instead.
			annotations: [
				{ ...newAnnotation('a', [1, 2, 3]), created: 1 },
				{ ...newAnnotation('b', [0, 0, 0]), done: true, created: 2 }
			],
			viewpoints: [newViewpoint('Hall', [0, 1.6, 0], 1)],
			sketches: [
				newSketch(
					'arrow',
					'#fa4d56',
					[
						[0, 0, 0],
						[1, 0, 0]
					],
					[0, 1, 0]
				)
			]
		};
		const back = fromJSON(toJSON(notes, 'house.dae', 'AAEC'));
		expect(back.notes).toEqual(notes);
		expect(back.yjs).toBe('AAEC');
	});

	it('reads a version 1 file, which has no creation times and no Yjs state', () => {
		const v1 =
			'{"version":1,"annotations":[{"id":"a","text":"t","done":false,"position":[0,0,0]}]}';
		const back = fromJSON(v1);
		expect(back.notes.annotations[0]).toMatchObject({ text: 't', created: 0 });
		expect(back.yjs).toBeUndefined();
	});

	it('rejects text that is not JSON', () => {
		expect(() => fromJSON('not json')).toThrow(/not valid JSON/);
	});

	it('says where a file went wrong', () => {
		expect(() =>
			fromJSON('{"annotations":[{"id":"a","text":"t","done":false,"position":[0,"x",0]}]}')
		).toThrow('(at annotations.0.position.1)');
	});

	it('rejects JSON that is not a set of notes', () => {
		expect(() => fromJSON('null')).toThrow(/not a recognised set of notes/);
		expect(() => fromJSON('{"annotations":[{"foo":1}]}')).toThrow(/not a recognised/);
		expect(() => fromJSON('{"viewpoints":"x"}')).toThrow(/not a recognised/);
		expect(() => fromJSON('{"sketches":[{"kind":"spiral"}]}')).toThrow(/not a recognised/);
	});

	// Empty is a valid reading; refusing to apply it is the page's call.
	it('reads an empty set as empty, not as an error', () => {
		expect(fromJSON('{}').notes).toEqual({ annotations: [], viewpoints: [], sketches: [] });
	});
});
