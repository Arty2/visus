// IBM Carbon icons, one registry for the page (Icon.svelte) and the
// headset's canvas panels (panel.ts), so both speak the same visual
// language. Each import is one icon's SVG description — elements and
// attributes, not markup — so nothing here is a string turned into HTML.
// Size-20 glyphs on Carbon's 32-unit grid, the size Carbon designs for UI.

import i_open from '@carbon/icons/es/folder--open/20.js';
import i_cube from '@carbon/icons/es/cube/20.js';
import i_vr from '@carbon/icons/es/augmented-reality/20.js';
import i_history from '@carbon/icons/es/recently-viewed/20.js';
import i_camera from '@carbon/icons/es/camera/20.js';
import i_pin from '@carbon/icons/es/location/20.js';
import i_plus from '@carbon/icons/es/add/20.js';
import i_bookmark from '@carbon/icons/es/bookmark--add/20.js';
import i_pencil from '@carbon/icons/es/edit/20.js';
import i_trash from '@carbon/icons/es/trash-can/20.js';
import i_download from '@carbon/icons/es/download/20.js';
import i_upload from '@carbon/icons/es/upload/20.js';
import i_help from '@carbon/icons/es/help/20.js';
import i_close from '@carbon/icons/es/close/20.js';
import i_arrowRight from '@carbon/icons/es/arrow--right/20.js';
import i_chevronLeft from '@carbon/icons/es/chevron--left/20.js';
import i_chevronRight from '@carbon/icons/es/chevron--right/20.js';
import i_shift from '@carbon/icons/es/arrow--up/20.js';
import i_backspace from '@carbon/icons/es/delete/20.js';
import i_check from '@carbon/icons/es/checkmark/20.js';
import i_exit from '@carbon/icons/es/exit/20.js';
import i_view from '@carbon/icons/es/view/20.js';
import i_viewOff from '@carbon/icons/es/view--off/20.js';
import i_sun from '@carbon/icons/es/sun/20.js';
import i_moon from '@carbon/icons/es/moon/20.js';
import i_sky from '@carbon/icons/es/partly-cloudy/20.js';
import i_studio from '@carbon/icons/es/contrast/20.js';
import i_fit from '@carbon/icons/es/center--square/20.js';
import i_person from '@carbon/icons/es/touch--1/20.js';
import i_undo from '@carbon/icons/es/undo/20.js';

export interface CarbonNode {
	elem: string;
	attrs: Record<string, string | number>;
	content?: CarbonNode[];
}

export interface CarbonIcon extends CarbonNode {
	name: string;
	content: CarbonNode[];
}

export const icons = {
	open: i_open as CarbonIcon,
	cube: i_cube as CarbonIcon,
	vr: i_vr as CarbonIcon,
	history: i_history as CarbonIcon,
	camera: i_camera as CarbonIcon,
	pin: i_pin as CarbonIcon,
	plus: i_plus as CarbonIcon,
	bookmark: i_bookmark as CarbonIcon,
	pencil: i_pencil as CarbonIcon,
	trash: i_trash as CarbonIcon,
	download: i_download as CarbonIcon,
	upload: i_upload as CarbonIcon,
	help: i_help as CarbonIcon,
	close: i_close as CarbonIcon,
	arrowRight: i_arrowRight as CarbonIcon,
	chevronLeft: i_chevronLeft as CarbonIcon,
	chevronRight: i_chevronRight as CarbonIcon,
	shift: i_shift as CarbonIcon,
	backspace: i_backspace as CarbonIcon,
	check: i_check as CarbonIcon,
	exit: i_exit as CarbonIcon,
	view: i_view as CarbonIcon,
	viewOff: i_viewOff as CarbonIcon,
	sun: i_sun as CarbonIcon,
	moon: i_moon as CarbonIcon,
	sky: i_sky as CarbonIcon,
	studio: i_studio as CarbonIcon,
	fit: i_fit as CarbonIcon,
	person: i_person as CarbonIcon,
	undo: i_undo as CarbonIcon
} as const;

export type IconName = keyof typeof icons;
