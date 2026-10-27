/*
 * Reads CHANGELOG.md for the "What's new" dialog. Parsed, not rendered as
 * Markdown: the file's rules (TECHNICAL.md § Versioning and the changelog)
 * allow plain text and `code` spans only, so that is all this understands,
 * and no Markdown library — or any route from a string to markup — is needed
 * to show it.
 */

/**
 * `## X.Y.Z — YYYY-MM-DD`, with an em dash, en dash or hyphen. scripts/gates.sh
 * matches the same shape, so a heading the gate accepts is never one this
 * skips — and the gate fails on any `## ` heading that doesn't match it.
 */
export const HEADING = /^## (\d+\.\d+\.\d+) (?:—|–|-) (\d{4}-\d{2}-\d{2})\s*$/;

export interface Release {
	version: string;
	date: string;
	/** One entry per bullet, wrapped continuation lines joined with a space. */
	lines: string[];
}

export interface Segment {
	text: string;
	code: boolean;
}

/** Releases newest first, as written. The preamble above the first is skipped. */
export function parseChangelog(text: string): Release[] {
	const releases: Release[] = [];
	let current: Release | null = null;

	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trimEnd();
		const heading = HEADING.exec(line);
		if (heading) {
			current = { version: heading[1], date: heading[2], lines: [] };
			releases.push(current);
		} else if (line.startsWith('#')) {
			// Any other heading ends the release before it rather than being
			// read as part of it.
			current = null;
		} else if (!current || line.trim() === '') {
			continue;
		} else if (line.startsWith('- ')) {
			current.lines.push(line.slice(2).trim());
		} else if (current.lines.length > 0) {
			current.lines[current.lines.length - 1] += ` ${line.trim()}`;
		}
	}

	return releases;
}

/** Splits a line into plain text and `code` runs. An unclosed backtick stays literal. */
export function segments(line: string): Segment[] {
	const parts = line.split('`');
	// An even number of parts means an odd number of backticks: the last one
	// opens nothing, so glue it back on as text rather than eat it.
	if (parts.length % 2 === 0) {
		const tail = parts.splice(-2).join('`');
		parts.push(tail);
	}
	return parts.map((text, i) => ({ text, code: i % 2 === 1 })).filter((s) => s.text !== '');
}

/**
 * Whether to open "What's new" on its own. Only after an update: a first run
 * has no previous version to compare and has the page itself as its
 * introduction, so it just records the current version as read.
 */
export function shouldAnnounce(lastSeen: string | null, current: string): boolean {
	return lastSeen !== null && lastSeen !== current;
}
