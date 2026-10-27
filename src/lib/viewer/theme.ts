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
	accent: '#4ee6c8',
	accentInk: '#03130f',
	accentSoft: 'rgba(78, 230, 200, 0.16)',
	note: '#ffb547',
	danger: '#ff7a7a',
	dangerSoft: 'rgba(255, 107, 107, 0.14)',
	font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
	mono: 'ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace'
} as const;

// The same palette as numbers, for three.js materials.
export const hex = {
	sky: 0x161b22,
	gridMajor: 0x3d4b59,
	gridMinor: 0x26303b,
	accent: 0x4ee6c8,
	danger: 0xff6b6b,
	note: 0xffb547,
	noteDone: 0x5d6a79,
	ray: 0xbff7ec,
	grip: 0x1a222c
} as const;
