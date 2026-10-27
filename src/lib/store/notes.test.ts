import { describe, expect, it } from 'vitest';
import { migrate, modelKey, newAnnotation, newViewpoint, SCHEMA_VERSION } from './notes';

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
