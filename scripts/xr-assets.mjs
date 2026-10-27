// Copies the controller and hand models @pmndrs/xr draws in the headset
// into static/xr/profiles/, at install, from @webxr-input-profiles/assets.
// Its default is a CDN, which the security policy refuses; copying at
// install keeps them in step with the package, as scripts/decoders.sh does
// for three's decoders. static/xr is gitignored.
//
// Only the profiles a Quest reports, and the generic ones @pmndrs/xr falls
// back to: not the hundred megabytes of every headset ever made.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const out = 'static/xr/profiles';
const from = 'node_modules/@webxr-input-profiles/assets/dist/profiles';
const QUEST = [
	'meta-quest-touch-plus',
	'meta-quest-touch-plus-v2',
	'meta-quest-touch-pro',
	'oculus-touch-v3',
	'generic-trigger',
	'generic-hand'
];

rmSync('static/xr', { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// The list names only what's copied: @pmndrs/xr chooses from it, and a
// profile it names but can't fetch is a 404 where the generic one would do.
const list = JSON.parse(readFileSync(`${from}/profilesList.json`, 'utf8'));
writeFileSync(
	`${out}/profilesList.json`,
	JSON.stringify(Object.fromEntries(Object.entries(list).filter(([id]) => QUEST.includes(id))))
);
for (const id of QUEST) cpSync(`${from}/${id}`, `${out}/${id}`, { recursive: true });
