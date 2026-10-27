import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseChangelog, segments, shouldAnnounce } from './changelog';

describe('parseChangelog', () => {
	it('reads releases newest first and skips the preamble', () => {
		const text = [
			'# Changelog',
			'',
			'Preamble, with - a dash and `code` that is not a release.',
			'',
			'## 0.4.2 — 2026-10-02',
			'',
			'- First line.',
			'- Second line,',
			'  wrapped onto two.',
			'',
			'## 0.3.0 - 2026-09-20',
			'- Older.'
		].join('\n');

		expect(parseChangelog(text)).toEqual([
			{
				version: '0.4.2',
				date: '2026-10-02',
				lines: ['First line.', 'Second line, wrapped onto two.']
			},
			{ version: '0.3.0', date: '2026-09-20', lines: ['Older.'] }
		]);
	});

	it('accepts an en dash and Windows line endings', () => {
		const [release] = parseChangelog('## 1.2.3 – 2026-01-01\r\n- Line.\r\n');
		expect(release).toEqual({ version: '1.2.3', date: '2026-01-01', lines: ['Line.'] });
	});

	it('does not read a malformed heading as a release, or its lines into the one before', () => {
		const text = '## 0.2.0 — 2026-10-03\n- Kept.\n## 0.1 — someday\n- Not kept.\n';
		expect(parseChangelog(text)).toEqual([
			{ version: '0.2.0', date: '2026-10-03', lines: ['Kept.'] }
		]);
	});

	it('returns nothing for a file with no releases', () => {
		expect(parseChangelog('# Changelog\n\nNothing yet.\n')).toEqual([]);
	});
});

describe('segments', () => {
	it('splits code spans from plain text', () => {
		expect(segments('Run `pnpm gates` first.')).toEqual([
			{ text: 'Run ', code: false },
			{ text: 'pnpm gates', code: true },
			{ text: ' first.', code: false }
		]);
	});

	it('leaves an unclosed backtick as literal text', () => {
		expect(segments('a `b` c `d')).toEqual([
			{ text: 'a ', code: false },
			{ text: 'b', code: true },
			{ text: ' c `d', code: false }
		]);
	});

	it('passes plain text through', () => {
		expect(segments('Plain.')).toEqual([{ text: 'Plain.', code: false }]);
	});
});

describe('shouldAnnounce', () => {
	it('stays closed on a first run', () => {
		expect(shouldAnnounce(null, '0.2.0')).toBe(false);
	});

	it('opens once after an update, and not again', () => {
		expect(shouldAnnounce('0.1.3', '0.2.0')).toBe(true);
		expect(shouldAnnounce('0.2.0', '0.2.0')).toBe(false);
	});
});

// The file the app actually ships, read the way the app reads it. The gate
// checks the same thing in shell; this proves the parser agrees with it.
describe('CHANGELOG.md', () => {
	const releases = parseChangelog(readFileSync('CHANGELOG.md', 'utf8'));
	const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

	it('opens with the version in package.json', () => {
		expect(releases[0]?.version).toBe(version);
	});

	it('has something to say about every release', () => {
		for (const release of releases) expect(release.lines.length).toBeGreaterThan(0);
	});
});
