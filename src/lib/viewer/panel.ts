import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';
import { theme } from './theme';
import { icons, type CarbonNode, type IconName } from '$lib/icons';

// What a headset panel shows, as data: buttons and lines of text placed in
// pixels on a fixed-size panel, the way a designer lays out a frame. ui.ts
// draws it with @pmndrs/uikit; this file holds the description, the pure
// layout helpers, and the canvas drawing the note labels still use.

export interface Control {
	id: string;
	label: string;
	x: number;
	y: number;
	w: number;
	h: number;
	/** Drawn as on: the current scale, notes shown. */
	active?: boolean;
	disabled?: boolean;
	/** A Carbon icon, drawn left of the label — or alone, if the label is empty. */
	icon?: IconName;
	/**
	 * primary: the one action a panel exists for; danger: leaving or
	 * deleting; field: a text box drawn behind a TextLine, not pressable.
	 */
	variant?: 'primary' | 'danger' | 'field';
}

export interface TextLine {
	text: string;
	x: number;
	y: number;
	size: number;
	align?: CanvasTextAlign;
	tone?: 'dim' | 'accent' | 'note';
	mono?: boolean;
	weight?: number;
}

/**
 * Where a line of text sits on a panel `width` pixels wide: its box, in the
 * panel's pixels from the top left. A TextLine is placed the way a canvas
 * places text — `x` is where the alignment anchors, `y` the middle of the
 * line — and a box keeps 40 px clear of the panel's sides.
 */
export function lineBox(line: TextLine, width: number) {
	const margin = 40;
	const height = Math.round(line.size * 1.4);
	const top = Math.round(line.y - height / 2);
	const align = line.align ?? 'left';
	if (align === 'right') return { left: margin, top, width: line.x - margin, height };
	if (align === 'center') {
		const half = Math.min(line.x, width - line.x) - margin;
		return { left: line.x - half, top, width: 2 * half, height };
	}
	return { left: line.x, top, width: width - margin - line.x, height };
}

const TONES = { dim: theme.dim, accent: theme.accent, note: theme.note } as const;

/** A TextLine's colour. */
export function toneOf(line: TextLine): string {
	return line.tone ? TONES[line.tone] : theme.text;
}

/** A text label that always faces the viewer, for a note pinned in the model. */
export function makeLabel(text: string, done: boolean): Sprite {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d')!;
	const size = 44;
	const font = `500 ${size}px ${theme.font}`;
	ctx.font = font;
	const label = fit(ctx, (done ? '✓ ' : '') + (text || '…'), 900);
	canvas.width = Math.ceil(ctx.measureText(label).width) + 64;
	canvas.height = 76;
	// Resizing a canvas resets its state, so the font is set again.
	ctx.font = font;
	ctx.fillStyle = theme.panel;
	roundRect(ctx, 1, 1, canvas.width - 2, canvas.height - 2, 38);
	ctx.fill();
	ctx.strokeStyle = done ? theme.line : theme.note;
	ctx.lineWidth = 2;
	ctx.stroke();
	// The amber dot ties the label to its pin and to the notes list.
	ctx.fillStyle = done ? theme.dim : theme.note;
	ctx.beginPath();
	ctx.arc(30, canvas.height / 2, 7, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = done ? theme.dim : theme.text;
	ctx.textBaseline = 'middle';
	ctx.fillText(label, 48, canvas.height / 2 + 2);

	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	const sprite = new Sprite(
		new SpriteMaterial({ map: texture, depthTest: false, toneMapped: false, transparent: true })
	);
	sprite.renderOrder = 5;
	// Anchored at the bottom centre, so it sits on top of its pin.
	sprite.center.set(0.5, -0.4);
	sprite.userData.aspect = canvas.width / canvas.height;
	return sprite;
}

export function disposeLabel(sprite: Sprite) {
	sprite.material.map?.dispose();
	sprite.material.dispose();
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
	if (ctx.measureText(text).width <= max) return text;
	const chars = [...text];
	while (chars.length && ctx.measureText(chars.join('') + '…').width > max) chars.pop();
	return chars.join('') + '…';
}

function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
) {
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, r);
}

/**
 * Draws a Carbon icon in the current fill colour, at (x, y), `size` pixels
 * square. Carbon draws on a 32-unit grid with paths, circles, rects and
 * polygons; a rect with fill="none" is its invisible bounding box.
 */
export function drawIcon(
	ctx: CanvasRenderingContext2D,
	name: IconName,
	x: number,
	y: number,
	size: number
) {
	const icon = icons[name];
	const [, , w] = String(icon.attrs.viewBox).split(' ').map(Number);
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(size / (w || 32), size / (w || 32));
	const draw = (n: CarbonNode) => {
		const a = n.attrs;
		if (a.fill === 'none') return;
		const path = new Path2D();
		if (n.elem === 'path') path.addPath(new Path2D(String(a.d)));
		else if (n.elem === 'circle') path.arc(+a.cx, +a.cy, +a.r, 0, Math.PI * 2);
		else if (n.elem === 'rect') path.rect(+(a.x ?? 0), +(a.y ?? 0), +a.width, +a.height);
		else if (n.elem === 'polygon') {
			const p = String(a.points)
				.trim()
				.split(/[\s,]+/)
				.map(Number);
			path.moveTo(p[0], p[1]);
			for (let i = 2; i < p.length; i += 2) path.lineTo(p[i], p[i + 1]);
			path.closePath();
		}
		ctx.fill(path, a['fill-rule'] === 'evenodd' ? 'evenodd' : 'nonzero');
		n.content?.forEach(draw);
	};
	icon.content.forEach(draw);
	ctx.restore();
}
