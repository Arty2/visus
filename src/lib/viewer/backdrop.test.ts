import { describe, expect, it } from 'vitest';
import { BACKDROP_ORDER, isBackdrop, nextBackdrop } from './backdrop';

describe('backdrops', () => {
	it('start from white', () => {
		expect(BACKDROP_ORDER[0]).toBe('white');
	});

	it('cycle through every one and wrap', () => {
		const seen = [BACKDROP_ORDER[0]];
		for (let i = 1; i < BACKDROP_ORDER.length; i++) seen.push(nextBackdrop(seen[i - 1]));
		expect(seen).toEqual(BACKDROP_ORDER);
		expect(nextBackdrop(seen[seen.length - 1])).toBe('white');
	});

	it('recognise only their own names', () => {
		expect(isBackdrop('sky')).toBe(true);
		expect(isBackdrop('constructor')).toBe(false);
		expect(isBackdrop(null)).toBe(false);
	});
});
