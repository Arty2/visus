import { newItem, type Item } from '$lib/store/items';

// Hand-rolled, not a library — see AGENTS.md § Before you change anything.
// Mirrors the checkbox convention listula and libelli both export,
// so a file written by one reads sensibly as a to-do list anywhere:
// '- [ ] ' undone, '- [x] ' or '- [X] ' done.
export function toMarkdown(items: Item[]): string {
	return items.map((item) => `- [${item.done ? 'x' : ' '}] ${item.text}`).join('\n') + '\n';
}

const CHECKBOX_LINE = /^-\s*\[([ xX])\]\s*(.*)$/;

// Deliberately more permissive on the way in than toMarkdown is on the way
// out — the point of Markdown is that it's the format everything else
// writes, not just this app. A checked box in either case counts as done; a
// bare bullet with no checkbox at all is accepted as an undone item, exactly
// as listula documents its own import doing.
//
// Prose with no bullets in it parses to `[]` rather than throwing: this is a
// reading of a file, not a verdict on it. The caller decides what an empty
// result means — +page.svelte refuses to apply one, which is what stops
// importing a README from quietly emptying the list.
export function fromMarkdown(text: string): Item[] {
	const items: Item[] = [];

	for (const rawLine of text.split('\n')) {
		const line = rawLine.trim();
		if (!line || !line.startsWith('-')) continue;

		const checkbox = line.match(CHECKBOX_LINE);
		if (checkbox) {
			const [, box, body] = checkbox;
			const text = body.trim();
			if (text) items.push({ ...newItem(text), done: box.toLowerCase() === 'x' });
			continue;
		}

		const bare = line.slice(1).trim();
		if (bare) items.push(newItem(bare));
	}

	return items;
}
