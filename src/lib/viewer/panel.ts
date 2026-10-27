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
}

export interface TextLine {
	text: string;
	x: number;
	y: number;
	size: number;
	align?: CanvasTextAlign;
	dim?: boolean;
}

/** The control under a point on the canvas, in canvas pixels. */
export function controlAt(controls: Control[], x: number, y: number): Control | null {
	return (
		controls.find((c) => !c.disabled && x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) ??
		null
	);
}

const INK = '#f4f1ea';
const PAPER = 'rgba(24, 24, 22, 0.92)';
const KEY = '#3a3a36';
const HOVER = '#6b6a62';
const ON = '#f4f1ea';
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

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
		ctx.fillStyle = PAPER;
		roundRect(ctx, 0, 0, width, height, 28);
		ctx.fill();

		ctx.textBaseline = 'middle';
		for (const c of this.controls) {
			ctx.fillStyle = c.active ? ON : c.id === this.hover && !c.disabled ? HOVER : KEY;
			roundRect(ctx, c.x, c.y, c.w, c.h, 14);
			ctx.fill();
			ctx.fillStyle = c.active ? '#1a1a18' : INK;
			ctx.globalAlpha = c.disabled ? 0.35 : 1;
			ctx.textAlign = 'center';
			ctx.font = `500 ${Math.round(Math.min(c.h * 0.42, 34))}px ${FONT}`;
			ctx.fillText(fit(ctx, c.label, c.w - 16), c.x + c.w / 2, c.y + c.h / 2 + 1);
			ctx.globalAlpha = 1;
		}

		for (const l of this.lines) {
			ctx.fillStyle = INK;
			ctx.globalAlpha = l.dim ? 0.6 : 1;
			ctx.textAlign = l.align ?? 'left';
			ctx.font = `${l.size}px ${FONT}`;
			ctx.fillText(fit(ctx, l.text, width - 2 * 24), l.x, l.y);
			ctx.globalAlpha = 1;
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
	ctx.font = `${size}px ${FONT}`;
	const shown = (done ? '✓ ' : '') + (text || '…');
	const label = fit(ctx, shown, 900);
	canvas.width = Math.ceil(ctx.measureText(label).width) + 40;
	canvas.height = 72;
	// Resizing a canvas resets its state, so the font is set again.
	ctx.font = `${size}px ${FONT}`;
	ctx.fillStyle = done ? 'rgba(60, 60, 56, 0.8)' : 'rgba(24, 24, 22, 0.88)';
	roundRect(ctx, 0, 0, canvas.width, canvas.height, 18);
	ctx.fill();
	ctx.fillStyle = done ? '#bdbab2' : INK;
	ctx.textBaseline = 'middle';
	ctx.fillText(label, 20, canvas.height / 2 + 2);

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
