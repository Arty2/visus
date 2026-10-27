#!/usr/bin/env bash
#
# The JavaScript budget. "Fast" is a number, not a feeling: a hard limit
# rather than a target, checked on the network that matters — a shared link
# opened on a phone with one bar of signal, not a warm cache on a dev machine.
#
# Measured gzipped, over everything the browser downloads to run the app.
# Raise BUDGET_KB deliberately, in the same commit that earns it, never as a
# side effect of an unrelated change.

set -euo pipefail

cd "$(dirname "$0")/.."

BUDGET_KB=100
DIR=.svelte-kit/output/client/_app/immutable

if [ ! -d "$DIR" ]; then
	printf 'no build to measure — run pnpm build first\n' >&2
	exit 1
fi

total=0
while IFS= read -r file; do
	size=$(gzip -c "$file" | wc -c)
	total=$((total + size))
done < <(find "$DIR" -name '*.js' -type f)

kb=$((total / 1024))

printf '  %s KB of JavaScript, gzipped (budget %s KB)\n' "$kb" "$BUDGET_KB"

if [ "$kb" -gt "$BUDGET_KB" ]; then
	printf '\nover budget\n' >&2
	exit 1
fi
