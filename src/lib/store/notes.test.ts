import { describe, expect, it } from 'vitest';
import { migrate, modelKey, newAnnotation, newViewpoint, SCHEMA_VERSION, uniqueIds } from './notes';

describe('migrate', () => {
	it('keeps valid notes and viewpoints, and drops what it does not recognise', () => {
		const good = newAnnotation('Check the stair width', [1, 0, -3]);
		const view = newViewpoint('Entrance', [0, 1.6, 4], 0.5);
		const notes = migrate({
			version: SCHEMA_VERSION,
			annotations: [good, { id: 'x', text: 'no position', done: false }],
			viewpoints: [view, { id: 'y', name: 'bad', position: [0, 'a', 0], yaw: 0 }]
		});
		expect(notes).toEqual({ annotations: [good], viewpoints: [view] });
	});

	it('turns anything else into an empty set rather than throwing', () => {
		const empty = { annotations: [], viewpoints: [] };
		expect(migrate(null)).toEqual(empty);
		expect(migrate('text')).toEqual(empty);
		expect(migrate({ version: 999, annotations: [] })).toEqual(empty);
		expect(migrate({ version: SCHEMA_VERSION })).toEqual(empty);
	});
});

describe('uniqueIds', () => {
	it('keeps the first of a repeated id and gives the rest fresh ones', () => {
		const a = newAnnotation('first', [0, 0, 0]);
		const out = uniqueIds([a, { ...a, text: 'second' }, { ...a, text: 'third' }]);
		expect(out[0]).toBe(a);
		expect(out.map((n) => n.text)).toEqual(['first', 'second', 'third']);
		expect(new Set(out.map((n) => n.id)).size).toBe(3);
	});

	it('is applied by migrate, so a bad record can never break the list', () => {
		const a = newAnnotation('x', [0, 0, 0]);
		const notes = migrate({ version: SCHEMA_VERSION, annotations: [a, a], viewpoints: [] });
		expect(new Set(notes.annotations.map((n) => n.id)).size).toBe(2);
	});
});

describe('migrate, on what it keeps', () => {
	it('drops keys it does not know, so stored data stays the shape it says', () => {
		const a = { ...newAnnotation('x', [0, 0, 0]), colour: 'red' };
		const [kept] = migrate({ version: SCHEMA_VERSION, annotations: [a] }).annotations;
		expect(kept).not.toHaveProperty('colour');
	});

	it('refuses infinite positions', () => {
		const a = { ...newAnnotation('x', [0, 0, 0]), position: [0, Infinity, 0] };
		expect(migrate({ version: SCHEMA_VERSION, annotations: [a] }).annotations).toEqual([]);
	});
});

describe('new notes', () => {
	it('round positions to the millimetre and fold negative zero', () => {
		const note = newAnnotation('x', [1.23456, -0.00001, 2]);
		expect(note.position).toEqual([1.235, 0, 2]);
		expect(Object.is(note.position[1], -0)).toBe(false);
	});
});

describe('modelKey', () => {
	it('tells two revisions of one file apart by size', () => {
		expect(modelKey('house.dae', 100)).not.toBe(modelKey('house.dae', 101));
	});
});
