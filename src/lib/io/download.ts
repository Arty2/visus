// Hand the browser a file — the one copy every export uses (the pattern is
// libelli's; see its src/lib/download.ts). Needs nothing allow-listed in the
// CSP: a Blob object URL lives in the tab's own memory, not on the network,
// so it isn't a fetch, a script load or a navigation to another origin.
export function downloadText(filename: string, mimeType: string, text: string) {
	const blob = new Blob([text], { type: mimeType });
	const url = URL.createObjectURL(blob);

	// Firefox only honours `download` on an anchor that's actually in the
	// document; Chrome doesn't need this but doesn't mind it either.
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();

	// Not revoked synchronously: some browsers start the download on the next
	// tick rather than inside click(), and a revoked URL by then downloads a
	// zero-byte file instead of the content.
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
