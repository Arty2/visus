import {
	CanvasTexture,
	DoubleSide,
	Mesh,
	MeshBasicMaterial,
	PlaneGeometry,
	SRGBColorSpace,
	Sprite,
	SpriteMaterial,
	type Vector2
} from 'three';
import { theme } from './theme';
import { icons, type CarbonNode, type IconName } from '$lib/icons';

// Flat UI inside the headset: a canvas drawn with the 2D API and shown as a
// texture on a plane. DOM overlays don't exist in an immersive VR session,
// and a canvas is the whole of what's needed for buttons and a keyboard —
// no UI library, no text-rendering dependency.

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

/** The control under a point on the canvas, in canvas pixels. */
export function controlAt(controls: Control[], x: number, y: number): Control | null {
	return (
		controls.find(
			(c) =>
				!c.disabled &&
				c.variant !== 'field' &&
				x >= c.x &&
				x <= c.x + c.w &&
				y >= c.y &&
				y <= c.y + c.h
		) ?? null
	);
}

const TONES = { dim: theme.dim, accent: theme.accent, note: theme.note } as const;

export class Panel {
	readonly mesh: Mesh<PlaneGeometry, MeshBasicMaterial>;
	readonly width: number;
	readonly height: number;
	private readonly ctx: CanvasRenderingContext2D;
	private readonly texture: CanvasTexture;
	private controls: Control[] = [];
	private lines: TextLine[] = [];
	private hover: string | null = null;

	constructor(width: number, height: number, metres: number) {
		this.width = width;
		this.height = height;
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		this.ctx = canvas.getContext('2d')!;
		this.texture = new CanvasTexture(canvas);
		this.texture.colorSpace = SRGBColorSpace;
		this.mesh = new Mesh(
			new PlaneGeometry(metres, (metres * height) / width),
			new MeshBasicMaterial({
				map: this.texture,
				transparent: true,
				side: DoubleSide,
				toneMapped: false,
				// Drawn over the model: a menu that a wall can cut in half is a
				// menu that can't be closed.
				depthTest: false
			})
		);
		this.mesh.renderOrder = 10;
		this.mesh.visible = false;
		// Drawn again once IBM Plex has loaded: a canvas paints with whatever
		// font is ready at that moment, and the first draw can beat it.
		document.fonts?.ready.then(() => this.draw());
	}

	set(controls: Control[], lines: TextLine[]) {
		this.controls = controls;
		this.lines = lines;
		this.draw();
	}

	setHover(id: string | null) {
		if (id === this.hover) return;
		this.hover = id;
		this.draw();
	}

	at(uv: Vector2): Control | null {
		return controlAt(this.controls, uv.x * this.width, (1 - uv.y) * this.height);
	}

	private draw() {
		const { ctx, width, height } = this;
		ctx.clearRect(0, 0, width, height);
		ctx.fillStyle = theme.panel;
		roundRect(ctx, 1, 1, width - 2, height - 2, 32);
		ctx.fill();
		ctx.strokeStyle = theme.line;
		ctx.lineWidth = 2;
		ctx.stroke();

		ctx.textBaseline = 'middle';
		for (const c of this.controls) {
			if (c.variant === 'field') {
				ctx.fillStyle = '#07090c';
				roundRect(ctx, c.x, c.y, c.w, c.h, 18);
				ctx.fill();
				ctx.strokeStyle = theme.accent;
				ctx.lineWidth = 3;
				ctx.stroke();
				continue;
			}
			const hover = c.id === this.hover && !c.disabled;
			const on = c.active || c.variant === 'primary';
			ctx.globalAlpha = c.disabled ? 0.35 : 1;

			ctx.fillStyle = on
				? theme.accent
				: c.variant === 'danger'
					? theme.dangerSoft
					: hover
						? theme.hover
						: theme.surface;
			roundRect(ctx, c.x, c.y, c.w, c.h, 18);
			ctx.fill();
			// The ray's target gets an accent ring, so where it points is never
			// a guess — the one cue a pointer at a picture has.
			if (hover) {
				ctx.strokeStyle = on ? theme.text : theme.accent;
				ctx.lineWidth = 3;
				ctx.stroke();
			}

			ctx.fillStyle = on ? theme.accentInk : c.variant === 'danger' ? theme.danger : theme.text;
			ctx.textAlign = 'center';
			ctx.font = `600 ${Math.round(Math.min(c.h * 0.4, 36))}px ${theme.font}`;
			const iconSize = Math.round(Math.min(c.h * 0.42, 40));
			const label = fit(ctx, c.label, c.w - 20 - (c.icon ? iconSize + 12 : 0));
			const textWidth = label ? ctx.measureText(label).width : 0;
			const gap = c.icon && label ? 12 : 0;
			const total = (c.icon ? iconSize : 0) + gap + textWidth;
			let x = c.x + (c.w - total) / 2;
			const cy = c.y + c.h / 2;
			if (c.icon) {
				drawIcon(ctx, c.icon, x, cy - iconSize / 2, iconSize);
				x += iconSize + gap;
			}
			if (label) {
				ctx.textAlign = 'left';
				ctx.fillText(label, x, cy + 1);
			}
			ctx.globalAlpha = 1;
		}

		for (const l of this.lines) {
			ctx.fillStyle = l.tone ? TONES[l.tone] : theme.text;
			ctx.textAlign = l.align ?? 'left';
			ctx.font = `${l.weight ?? 500} ${l.size}px ${l.mono ? theme.mono : theme.font}`;
			ctx.fillText(fit(ctx, l.text, width - 2 * 40), l.x, l.y);
		}

		this.texture.needsUpdate = true;
	}

	dispose() {
		this.texture.dispose();
		this.mesh.geometry.dispose();
		this.mesh.material.dispose();
	}
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
