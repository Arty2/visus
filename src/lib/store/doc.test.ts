import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { docFrom, encode, listMap, loadDoc, mergeEncoded, readNotes, upsert } from './doc';
import { emptyNotes, newAnnotation, newSketch, newViewpoint } from './notes';

describe('loadDoc', () => {
	it('carries version 1 data over, in its stored order', () => {
		const doc = loadDoc({
			version: 1,
			annotations: [
				{ id: 'b', text: 'second', done: false, position: [0, 0, 0] },
				{ id: 'a', text: 'first?', done: true, position: [1, 0, 0] }
			],
			viewpoints: [{ id: 'v', name: 'Hall', position: [0, 1.6, 0], yaw: 0 }]
		});
		const notes = readNotes(doc);
		expect(notes.annotations.map((a) => a.text)).toEqual(['second', 'first?']);
		expect(notes.viewpoints[0].name).toBe('Hall');
		expect(notes.sketches).toEqual([]);
	});

	it('round-trips a version 2 document through storage', () => {
		const doc = docFrom({ ...emptyNotes(), annotations: [newAnnotation('kept', [0, 1, 2])] });
		const again = loadDoc({ version: 2, yjs: encode(doc) });
		expect(readNotes(again).annotations[0].text).toBe('kept');
	});

	it('treats a document that will not decode like any other garbage', () => {
		expect(readNotes(loadDoc({ version: 2, yjs: 'bm90IHlqcw==' }))).toEqual(emptyNotes());
		expect(readNotes(loadDoc('nonsense'))).toEqual(emptyNotes());
	});
});

describe('merging', () => {
	it('keeps both people’s work when two copies were edited apart', () => {
		const mine = docFrom({ ...emptyNotes(), annotations: [newAnnotation('shared', [0, 0, 0])] });
		const theirs = loadDoc({ version: 2, yjs: encode(mine) });

		upsert(mine, { annotations: [newAnnotation('mine', [1, 0, 0])] });
		upsert(theirs, {
			annotations: [newAnnotation('theirs', [2, 0, 0])],
			viewpoints: [newViewpoint('Their view', [0, 1.6, 0], 0)],
			sketches: [
				newSketch('line', '#fa4d56', [
					[0, 0, 0],
					[1, 0, 0]
				])
			]
		});

		mergeEncoded(mine, encode(theirs));
		const notes = readNotes(mine);
		expect(notes.annotations.map((a) => a.text).sort()).toEqual(['mine', 'shared', 'theirs']);
		expect(notes.viewpoints).toHaveLength(1);
		expect(notes.sketches).toHaveLength(1);
	});

	it('drops anything in a document that its schema refuses', () => {
		const doc = new Y.Doc();
		listMap(doc, 'annotations').set('x', { id: 'x', text: 3 });
		upsert(doc, { annotations: [newAnnotation('fine', [0, 0, 0])] });
		expect(readNotes(doc).annotations.map((a) => a.text)).toEqual(['fine']);
	});
});
