#!/usr/bin/env bash
#
# Copies three.js's own Draco and Basis (KTX2) decoders into static/, where
# DRACOLoader and KTX2Loader fetch them by fixed file name. Copied at
# install rather than committed, so they always match the three.js that's
# installed — a decoder from another release can fail on its loader in ways
# that look like a broken model. static/decoders is gitignored.

set -euo pipefail
cd "$(dirname "$0")/.."

libs=node_modules/three/examples/jsm/libs
out=static/decoders

if [ ! -d "$libs/draco/gltf" ] || [ ! -d "$libs/basis" ]; then
	printf 'three.js decoders not found under %s — is three installed?\n' "$libs" >&2
	exit 1
fi

rm -rf "$out"
mkdir -p "$out/draco" "$out/basis"
cp "$libs"/draco/gltf/* "$out/draco/"
cp "$libs"/basis/* "$out/basis/"
