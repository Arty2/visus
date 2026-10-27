// The in-headset keyboard, as data. Text entry is the one thing WebXR leaves
// entirely to the app: the system keyboard can't be summoned inside an
// immersive session. The panel that draws it is panel.ts; this is the
// layout and what each key does, so both are testable without a GPU.

export interface Key {
	id: string;
	label: string;
	/** Width in key units; most keys are 1. */
	span: number;
}

const ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm,.'];

export function keyboardRows(shift: boolean): Key[][] {
	const rows: Key[][] = ROWS.map((row) =>
		[...row].map((ch) => {
			const label = shift ? shiftOf(ch) : ch;
			return { id: `char:${label}`, label, span: 1 };
		})
	);
	rows[2].push({ id: 'backspace', label: '⌫', span: 1 });
	rows[3].unshift({ id: 'shift', label: '⇧', span: 1 });
	rows.push([
		{ id: 'cancel', label: 'Cancel', span: 2 },
		{ id: 'char: ', label: 'space', span: 5 },
		{ id: 'save', label: 'Save', span: 3 }
	]);
	return rows;
}

// Digits stay digits under shift: shift comes on by itself at the start of a
// note, and a note that starts with a measurement shouldn't start with "!".
// The two punctuation keys give the marks a review note actually needs.
function shiftOf(ch: string): string {
	const shifted: Record<string, string> = { ',': '?', '.': '!' };
	return shifted[ch] ?? ch.toUpperCase();
}

export const MAX_NOTE = 280;

export interface KeyResult {
	text: string;
	shift: boolean;
	/** Set when the key ends editing. */
	done?: 'save' | 'cancel';
}

/**
 * What pressing `id` does to `text`. Shift lasts one character, as on a
 * phone, and comes back on by itself where a sentence starts.
 */
export function pressKey(text: string, shift: boolean, id: string): KeyResult {
	if (id === 'shift') return { text, shift: !shift };
	if (id === 'backspace') return { text: [...text].slice(0, -1).join(''), shift };
	if (id === 'save' || id === 'cancel') return { text, shift, done: id };
	if (id.startsWith('char:')) {
		const ch = id.slice(5);
		if ([...text].length >= MAX_NOTE) return { text, shift };
		const next = text + ch;
		return { text: next, shift: autoShift(next) };
	}
	return { text, shift };
}

/** Shift is on by itself at the start of a note and after a full stop. */
export function autoShift(text: string): boolean {
	return text.length === 0 || /[.!?]\s$/.test(text);
}
