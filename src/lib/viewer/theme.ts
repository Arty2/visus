// The headset's half of the design tokens in src/app.css — the canvases
// drawn in VR can't read CSS custom properties, so the values are repeated
// here, once. Change one file, change the other.

export const theme = {
	panel: 'rgba(11, 15, 20, 0.94)',
	surface: '#18202b',
	hover: '#243140',
	line: '#2d3a48',
	text: '#e8eef5',
	dim: '#9aa8b8',
	accent: '#ff832b',
	accentInk: '#1c0f00',
	accentSoft: 'rgba(255, 131, 43, 0.16)',
	note: '#be95ff',
	danger: '#ff7a7a',
	dangerSoft: 'rgba(255, 107, 107, 0.14)',
	font: '"IBM Plex Sans Variable", system-ui, sans-serif',
	mono: '"IBM Plex Mono", ui-monospace, monospace'
} as const;

// The same palette as numbers, for three.js materials.
export const hex = {
	accent: 0xff832b,
	danger: 0xff6b6b,
	note: 0xbe95ff,
	noteDone: 0x5d6a79,
	ray: 0xffd2b0,
	grip: 0x1a222c
} as const;
