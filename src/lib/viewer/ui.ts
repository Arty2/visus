import { CanvasTexture, Group, SRGBColorSpace, type Texture } from 'three';
import { Container, Image, Text } from '@pmndrs/uikit';
import type { IconName } from '$lib/icons';
import { drawIcon, lineBox, toneOf, type Control, type TextLine } from './panel';
import { theme } from './theme';

/*
 * Panels inside the headset, drawn by @pmndrs/uikit: real layout, rounded
 * corners and borders as geometry, and text as signed-distance glyphs — sharp
 * at any distance, where a canvas texture blurs as you lean in. Hover and
 * press arrive as pointer events from @pmndrs/xr, so a controller's ray, a
 * hand's pinch and a fingertip's poke all work the same.
 *
 * What a panel shows is still the plain description in panel.ts (buttons and
 * lines of text placed in pixels), so the layout code didn't change and a
 * button is where it always was.
 */

// IBM Plex as signed-distance-field atlases, rendered ahead of time by
// scripts/fonts.mjs (which says why) and served from static/msdf/. uikit
// loads a weight the first time a panel shows text in it.
const FONTS = {
	sans: {
		normal: '/msdf/plex-sans-400.json',
		'semi-bold': '/msdf/plex-sans-600.json',
		bold: '/msdf/plex-sans-700.json'
	},
	mono: { medium: '/msdf/plex-mono-500.json' }
};

// Carbon icons as small textures, one per icon and colour: uikit's own SVG
// component parses markup with DOMParser, which the Trusted Types policy
// refuses — and these are the same drawings the page's icons are.
const iconTextures = new Map<string, Texture>();
function iconTexture(name: IconName, colour: string): Texture {
	const key = `${name}:${colour}`;
	let texture = iconTextures.get(key);
	if (!texture) {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = 96;
		const ctx = canvas.getContext('2d')!;
		ctx.fillStyle = colour;
		drawIcon(ctx, name, 0, 0, 96);
		texture = new CanvasTexture(canvas);
		texture.colorSpace = SRGBColorSpace;
		iconTextures.set(key, texture);
	}
	return texture;
}

// uikit reads #rrggbbaa as sRGB, like every other colour here; rgba() it
// would take as linear, and too bright.
const PANEL = '#0b0f14f0';
const DANGER_SOFT = '#ff6b6b24';
const FIELD = '#07090c';

interface Part {
	key: string;
	node: Container | Text;
}

export class Panel {
	/** Placed and shown by the viewer; the panel itself is centred on it. */
	readonly mesh = new Group();
	private readonly root: Container;
	private parts: Part[] = [];

	constructor(
		readonly width: number,
		readonly height: number,
		metres: number,
		private readonly onPress: (id: string) => void
	) {
		this.root = new Container({
			width,
			height,
			pixelSize: metres / width,
			backgroundColor: PANEL,
			borderRadius: 32,
			borderWidth: 2,
			borderColor: theme.line,
			// Drawn over the model and first to the pointer: a menu that a wall
			// can cut in half, or that the wall behind it takes the click from,
			// is a menu that can't be closed.
			depthTest: false,
			depthWrite: false,
			renderOrder: 10,
			pointerEventsOrder: 2,
			fontFamilies: FONTS,
			fontFamily: 'sans',
			color: theme.text
		});
		this.mesh.add(this.root);
		this.mesh.visible = false;
	}

	/**
	 * Shows these controls and lines. Called again for every change, so parts
	 * that are as they were are kept: two-hand scaling rewrites the scale on
	 * the menu every frame, and only that line is rebuilt.
	 */
	set(controls: Control[], lines: TextLine[]) {
		const wanted: Part[] = [
			...controls.map((c) => ({ key: 'c' + JSON.stringify(c), make: () => this.control(c) })),
			...lines.map((l) => ({ key: 'l' + JSON.stringify(l), make: () => this.line(l) }))
		].map(({ key, make }) => {
			const kept = this.parts.find((p) => p.key === key);
			return kept ?? { key, node: make() };
		});
		for (const old of this.parts) {
			if (wanted.includes(old)) continue;
			this.root.remove(old.node);
			old.node.dispose();
		}
		// Re-added in order: later parts are drawn over earlier ones.
		for (const part of wanted) this.root.add(part.node);
		this.parts = wanted;
	}

	update(delta: number) {
		if (this.mesh.visible) this.root.update(delta);
	}

	/** Whether a world-space ray from `raycaster` meets the panel. */
	get target() {
		return this.root;
	}

	private control(c: Control): Container {
		const at = {
			positionType: 'absolute' as const,
			positionLeft: c.x,
			positionTop: c.y,
			width: c.w,
			height: c.h,
			borderRadius: 18
		};
		if (c.variant === 'field') {
			return new Container({
				...at,
				backgroundColor: FIELD,
				borderWidth: 3,
				borderColor: theme.accent,
				pointerEvents: 'none'
			});
		}
		const on = c.active || c.variant === 'primary';
		const danger = c.variant === 'danger';
		const background = on ? theme.accent : danger ? DANGER_SOFT : theme.surface;
		const ink = on ? theme.accentInk : danger ? theme.danger : theme.text;
		const button = new Container({
			...at,
			backgroundColor: background,
			// The ray's target gets an accent ring, so where it points is
			// never a guess.
			borderWidth: 3,
			borderColor: 'transparent',
			hover: {
				borderColor: on ? theme.text : theme.accent,
				...(on || danger ? {} : { backgroundColor: theme.hover })
			},
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			gap: 12,
			paddingX: 10,
			overflow: 'hidden',
			opacity: c.disabled ? 0.35 : 1,
			pointerEvents: c.disabled ? 'none' : 'auto',
			onClick: () => this.onPress(c.id)
		});
		const iconSize = Math.round(Math.min(c.h * 0.42, 40));
		if (c.icon) {
			button.add(
				new Image({
					src: iconTexture(c.icon, ink),
					width: iconSize,
					height: iconSize,
					flexShrink: 0,
					pointerEvents: 'none'
				})
			);
		}
		if (c.label) {
			button.add(
				new Text({
					text: c.label,
					fontSize: Math.round(Math.min(c.h * 0.4, 36)),
					fontWeight: 'semi-bold',
					color: ink,
					wordBreak: 'keep-all',
					whiteSpace: 'pre',
					pointerEvents: 'none'
				})
			);
		}
		return button;
	}

	private line(l: TextLine): Container {
		const box = lineBox(l, this.width);
		const holder = new Container({
			positionType: 'absolute',
			positionLeft: box.left,
			positionTop: box.top,
			width: box.width,
			height: box.height,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent:
				l.align === 'right' ? 'flex-end' : l.align === 'center' ? 'center' : 'flex-start',
			overflow: 'hidden',
			pointerEvents: 'none'
		});
		holder.add(
			new Text({
				text: l.text,
				fontSize: l.size,
				fontFamily: l.mono ? 'mono' : 'sans',
				fontWeight: l.weight ?? 500,
				color: toneOf(l),
				wordBreak: 'keep-all',
				whiteSpace: 'pre'
			})
		);
		return holder;
	}

	dispose() {
		for (const part of this.parts) part.node.dispose();
		this.parts = [];
		this.root.dispose();
	}
}
