import { describe, expect, it } from 'vitest';
import { defaultItems, isItem, migrate, newItem, SCHEMA_VERSION } from './items';

describe('newItem', () => {
	it('starts undone, with the given text', () => {
		const item = newItem('buy milk');
		expect(item.text).toBe('buy milk');
		expect(item.done).toBe(false);
		expect(item.id).toBeTruthy();
	});

	it('gives two items different ids', () => {
		expect(newItem('a').id).not.toBe(newItem('a').id);
	});
});

describe('isItem', () => {
	it('accepts a well-formed item', () => {
		expect(isItem(newItem('x'))).toBe(true);
	});

	it.each([
		null,
		undefined,
		'x',
		42,
		{},
		{ id: '1', text: 'x' },
		{ id: 1, text: 'x', done: false }
	])('rejects %j', (value) => {
		expect(isItem(value)).toBe(false);
	});
});

function shapes(items: { text: string; done: boolean }[]) {
	return items.map(({ text, done }) => ({ text, done }));
}

describe('migrate', () => {
	it('falls back to the starter items for garbage input', () => {
		expect(shapes(migrate(null))).toEqual(shapes(defaultItems()));
		expect(shapes(migrate('not an object'))).toEqual(shapes(defaultItems()));
		expect(shapes(migrate({}))).toEqual(shapes(defaultItems()));
	});

	it('passes through a well-formed current-version payload', () => {
		const items = [newItem('a'), newItem('b')];
		expect(migrate({ version: SCHEMA_VERSION, items })).toEqual(items);
	});

	it('drops malformed entries rather than the whole list', () => {
		const good = newItem('keep me');
		const result = migrate({ version: SCHEMA_VERSION, items: [good, { bad: true }] });
		expect(result).toEqual([good]);
	});
});
