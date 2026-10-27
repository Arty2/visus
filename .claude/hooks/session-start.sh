#!/bin/bash
# Gets a fresh Claude Code on the web container ready to run `pnpm test`,
# `pnpm run check` and `pnpm run lint` before the session's first command,
# rather than spending that first turn on an install.
set -euo pipefail

# Local checkouts manage their own node_modules; this is only for the remote
# container, which starts from a bare clone every time.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
	exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

corepack enable >/dev/null 2>&1 || true

# install, not --frozen-lockfile: the container image is cached after this
# hook completes, and a plain install can reuse what is already there.
# Idempotent either way.
pnpm install

# Generates .svelte-kit/tsconfig.json, which the repo's tsconfig.json
# extends. `pnpm run check` would do this itself; doing it here means an
# editor or a type-aware tool that reads tsconfig.json on open does not trip
# over a missing base config.
pnpm exec svelte-kit sync
