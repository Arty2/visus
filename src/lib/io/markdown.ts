import { newAnnotation, type Annotation, type Vec3 } from '$lib/store/notes';

// Hand-rolled, not a library. The checkbox convention listula and libelli
// share, so a review exported from here reads as a to-do list anywhere:
// '- [ ] ' open, '- [x] ' resolved. Where the note is pinned follows the text
// as `@ x, y, z` in metres — the part a person can ignore and this app can't.
// Viewpoints don't fit a list of things to do, so they travel in JSON only.
export function toMarkdown(annotations: Annotation[], model: string): string {
	const lines = annotations.map((a) => {
		const [x, y, z] = a.position.map((n) => n.toFixed(3));
		return `- [${a.done ? 'x' : ' '}] ${a.text || '(empty)'} @ ${x}, ${y}, ${z}`;
	});
	return `# Notes on ${model}\n\n${lines.join('\n')}\n`;
}

const LINE =
	/^-\s*\[([ xX])\]\s*(.*?)\s*@\s*\(?\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)?\s*$/;

// Reads only lines that carry a position: a note with nowhere to be pinned
// isn't one this app can show, and guessing a place would be inventing data.
// Prose, headings and bare bullets read as nothing — which the caller
// refuses, rather than this quietly deciding an empty import is fine.
export function fromMarkdown(text: string): Annotation[] {
	const notes: Annotation[] = [];

	for (const raw of text.split('\n')) {
		const match = raw.trim().match(LINE);
		if (!match) continue;
		const [, box, body, x, y, z] = match;
		const position = [x, y, z].map(Number) as Vec3;
		if (!position.every(Number.isFinite)) continue;
		const text = body === '(empty)' ? '' : body;
		notes.push({ ...newAnnotation(text, position), done: box.toLowerCase() === 'x' });
	}

	return notes;
}
