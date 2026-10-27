import { describe, expect, it } from 'vitest';
import { newItem } from '$lib/store/items';
import { fromMarkdown, toMarkdown } from './markdown';

describe('toMarkdown', () => {
	it('writes an undone item as [ ] and a done one as [x]', () => {
		const items = [newItem('buy milk'), { ...newItem('walk the dog'), done: true }];
		expect(toMarkdown(items)).toBe('- [ ] buy milk\n- [x] walk the dog\n');
	});
});

describe('fromMarkdown', () => {
	it('reads back what toMarkdown writes', () => {
		const items = [newItem('a'), { ...newItem('b'), done: true }];
		const round = fromMarkdown(toMarkdown(items)).map(({ text, done }) => ({ text, done }));
		expect(round).toEqual(items.map(({ text, done }) => ({ text, done })));
	});

	it('accepts an uppercase X as done', () => {
		expect(fromMarkdown('- [X] done already')[0].done).toBe(true);
	});

	it('accepts a bare bullet with no checkbox as an undone item', () => {
		const [item] = fromMarkdown('- just a note');
		expect(item.text).toBe('just a note');
		expect(item.done).toBe(false);
	});

	it('skips blank lines and lines that are not bullets', () => {
		const items = fromMarkdown('\n# A heading\n- [ ] one\n\nsome prose\n- [ ] two\n');
		expect(items.map((i) => i.text)).toEqual(['one', 'two']);
	});

	// Prose with no bullets reads as nothing found, rather than throwing.
	// Refusing to *apply* that is the caller's job — +page.svelte does it for
	// both formats, which is what stops importing a README emptying the list.
	it('reads prose with no bullets as no items', () => {
		expect(fromMarkdown('# Readme\n\nJust some prose, no list at all.\n')).toEqual([]);
	});
});
