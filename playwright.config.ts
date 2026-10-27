import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

/*
 * CI installs the Chromium build this Playwright pins. Some dev containers
 * ship a different one already; when that is the case, use it rather than
 * downloading a second copy of the same browser.
 */
const preinstalled = '/opt/pw-browsers/chromium';
const executablePath = !process.env.CI && existsSync(preinstalled) ? preinstalled : undefined;

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.e2e.{ts,js}',
	fullyParallel: true,
	workers: process.env.CI ? 4 : '50%',
	// One retry on CI. Not a licence for flaky tests — cover for real timing
	// edges; a retry that passes still shows up in the report as flaky.
	retries: process.env.CI ? 1 : 0,
	/*
	 * Never reused, on any machine. A preview server already listening on 4173
	 * would otherwise be adopted as-is, serving whatever build happened to be
	 * on disk — every failure then points at the wrong thing. Building and
	 * starting fresh costs a few seconds and removes a whole class of failure
	 * that looks exactly like a real one.
	 */
	webServer: {
		command: 'pnpm run build && pnpm run preview',
		port: 4173,
		reuseExistingServer: false
	},
	use: { baseURL: 'http://localhost:4173' },
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } }
		}
	]
});
