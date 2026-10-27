import { describe, expect, it } from 'vitest';
import { newAnnotation } from '$lib/store/notes';
import { fromMarkdown, toMarkdown } from './markdown';

describe('toMarkdown / fromMarkdown', () => {
	it('round-trips text, state and position', () => {
		const notes = [
			newAnnotation('Stair too steep @ landing', [1.2, 0, -3.4]),
			{ ...newAnnotation('Door swings the wrong way', [-2, 0.5, 7]), done: true }
		];
		const back = fromMarkdown(toMarkdown(notes, 'house.dae'));
		expect(back.map(({ text, done, position }) => ({ text, done, position }))).toEqual(
			notes.map(({ text, done, position }) => ({ text, done, position }))
		);
	});

	it('writes a list a person can read', () => {
		const md = toMarkdown([newAnnotation('Check', [1, 2, 3])], 'house.dae');
		expect(md).toBe('# Notes on house.dae\n\n- [ ] Check @ 1.000, 2.000, 3.000\n');
	});

	it('accepts a position in brackets, and keeps an empty note empty', () => {
		const [note] = fromMarkdown('- [X] (empty) @ (1, -2.5, 3)');
		expect(note.text).toBe('');
		expect(note.done).toBe(true);
		expect(note.position).toEqual([1, -2.5, 3]);
	});

	it('reads prose and unpinned bullets as nothing', () => {
		expect(fromMarkdown('# Readme\n\nJust prose.\n- [ ] no position\n- bare')).toEqual([]);
	});
});
