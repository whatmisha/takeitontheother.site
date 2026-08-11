#!/bin/sh

# Compatibility wrapper. The Node generator is the single manifest implementation.
exec node "$(dirname "$0")/generate-presets-manifest.js" "$@"

























