import type { IconName } from '$lib/icons';

// What the model is seen against. White is the default — models read best
// against it, and it's what an architect's drawings are on — whatever the
// page's own dark theme. The others are a choice, remembered per browser.

export type Backdrop = 'white' | 'studio' | 'sky' | 'night';

export interface BackdropStyle {
	label: string;
	icon: IconName;
	/** The flat background colour; the sky draws its own. */
	colour: number;
	/** The ground grid: lines every metre, and its centre lines. */
	grid: { major: number; minor: number };
}

export const BACKDROPS: Record<Backdrop, BackdropStyle> = {
	white: {
		label: 'White',
		icon: 'sun',
		colour: 0xffffff,
		grid: { major: 0xb9c0c7, minor: 0xdfe3e7 }
	},
	studio: {
		label: 'Studio',
		icon: 'studio',
		colour: 0xc9ced3,
		grid: { major: 0x9aa2aa, minor: 0xb3b9bf }
	},
	sky: { label: 'Sky', icon: 'sky', colour: 0xa9c7e8, grid: { major: 0x8f9aa3, minor: 0xb4bcc3 } },
	night: {
		label: 'Night',
		icon: 'moon',
		colour: 0x161b22,
		grid: { major: 0x3d4b59, minor: 0x26303b }
	}
};

export const BACKDROP_ORDER = Object.keys(BACKDROPS) as Backdrop[];

export function isBackdrop(value: unknown): value is Backdrop {
	return typeof value === 'string' && Object.hasOwn(BACKDROPS, value);
}

/** The one after `current`, wrapping — how the headset's single button cycles. */
export function nextBackdrop(current: Backdrop): Backdrop {
	const i = BACKDROP_ORDER.indexOf(current);
	return BACKDROP_ORDER[(i + 1) % BACKDROP_ORDER.length];
}
