import { describe, expect, it } from 'vitest';
import { controlAt, type Control } from './panel';

const controls: Control[] = [
	{ id: 'a', label: 'A', x: 0, y: 0, w: 100, h: 50 },
	{ id: 'b', label: 'B', x: 110, y: 0, w: 100, h: 50, disabled: true }
];

describe('controlAt', () => {
	it('finds the control under a point, edges included', () => {
		expect(controlAt(controls, 50, 25)?.id).toBe('a');
		expect(controlAt(controls, 100, 50)?.id).toBe('a');
	});

	it('misses in the gaps and on disabled controls', () => {
		expect(controlAt(controls, 105, 25)).toBeNull();
		expect(controlAt(controls, 150, 25)).toBeNull();
	});
});
