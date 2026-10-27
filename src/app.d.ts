// See https://svelte.dev/docs/kit/types#app.d.ts for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Injected by vite.config.ts from package.json, read back in the version
	// credit and asserted against it in e2e/smoke.e2e.ts — see AGENTS.md § Versioning.
	const __VERSION__: string;
}

export {};
