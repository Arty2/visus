import { describe, expect, it } from 'vitest';
import { newItem } from '$lib/store/items';
import { fromJSON, toJSON } from './json';

describe('toJSON / fromJSON', () => {
	it('round-trips a list of items', () => {
		const items = [newItem('a'), { ...newItem('b'), done: true }];
		expect(fromJSON(toJSON(items))).toEqual(items);
	});

	it('accepts a bare array, not just the wrapped export shape', () => {
		const items = [newItem('a')];
		expect(fromJSON(JSON.stringify(items))).toEqual(items);
	});

	it('rejects text that is not JSON', () => {
		expect(() => fromJSON('not json')).toThrow(/not valid JSON/);
	});

	it('rejects JSON that is not a recognised item list', () => {
		expect(() => fromJSON('{}')).toThrow(/not a recognised item list/);
		expect(() => fromJSON('[{"foo":"bar"}]')).toThrow(/not a recognised item list/);
	});

	// An empty list is a valid reading, not a parse failure — whether to
	// *apply* one is the caller's call (see +page.svelte). Asserted so the
	// round trip stays total: anything this app writes, it can read back.
	it('reads an empty list back as an empty list', () => {
		expect(fromJSON(toJSON([]))).toEqual([]);
		expect(fromJSON('[]')).toEqual([]);
	});
});
