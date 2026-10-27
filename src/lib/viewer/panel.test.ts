import { describe, expect, it } from 'vitest';
import { lineBox } from './panel';

describe('lineBox', () => {
	it('runs a left-aligned line from x to the right margin, centred on y', () => {
		expect(lineBox({ text: 'a', x: 40, y: 64, size: 40 }, 1024)).toEqual({
			left: 40,
			top: 36,
			width: 944,
			height: 56
		});
	});

	it('ends a right-aligned line at x', () => {
		const box = lineBox({ text: 'a', x: 984, y: 64, size: 40, align: 'right' }, 1024);
		expect(box.left + box.width).toBe(984);
		expect(box.left).toBe(40);
	});

	it('centres a centred line on x, inside the margins', () => {
		const box = lineBox({ text: 'a', x: 512, y: 772, size: 24, align: 'center' }, 1024);
		expect(box.left + box.width / 2).toBe(512);
		expect(box.left).toBe(40);
		const off = lineBox({ text: 'a', x: 300, y: 10, size: 24, align: 'center' }, 1024);
		expect(off.left).toBe(40);
		expect(off.left + off.width / 2).toBe(300);
	});
});
