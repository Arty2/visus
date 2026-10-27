import { describe, expect, it } from 'vitest';
import { autoShift, keyboardRows, MAX_NOTE, pressKey } from './keyboard';

describe('keyboardRows', () => {
	it('has every letter once, and the keys that end editing', () => {
		const ids = keyboardRows(false)
			.flat()
			.map((k) => k.id);
		for (const ch of 'abcdefghijklmnopqrstuvwxyz') expect(ids).toContain(`char:${ch}`);
		expect(ids).toEqual(expect.arrayContaining(['save', 'cancel', 'backspace', 'shift', 'char: ']));
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('shifts letters and punctuation, but never the digits', () => {
		const labels = keyboardRows(true)
			.flat()
			.map((k) => k.label);
		expect(labels).toContain('Q');
		expect(labels).toContain('?');
		expect(labels).toEqual(expect.arrayContaining([...'1234567890']));
	});
});

describe('pressKey', () => {
	it('types, deletes and finishes', () => {
		let r = pressKey('', true, 'char:S');
		expect(r).toEqual({ text: 'S', shift: false });
		r = pressKey(r.text, r.shift, 'char:t');
		r = pressKey(r.text, r.shift, 'backspace');
		expect(r.text).toBe('S');
		expect(pressKey('x', false, 'save').done).toBe('save');
		expect(pressKey('x', false, 'cancel').done).toBe('cancel');
	});

	it('deletes a whole emoji, not half of one', () => {
		expect(pressKey('ok 👍', false, 'backspace').text).toBe('ok ');
	});

	it('stops at the length limit', () => {
		const full = 'a'.repeat(MAX_NOTE);
		expect(pressKey(full, false, 'char:b').text).toBe(full);
	});

	it('capitalises the start of a sentence by itself', () => {
		expect(autoShift('')).toBe(true);
		expect(autoShift('Done. ')).toBe(true);
		expect(autoShift('Done')).toBe(false);
		expect(pressKey('Check.', false, 'char: ').shift).toBe(true);
	});
});
