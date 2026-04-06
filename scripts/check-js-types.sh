#!/usr/bin/env bash
set -euo pipefail

npx --yes -p typescript tsc \
  --allowJs \
  --checkJs \
  --noEmit \
  --target ES2022 \
  --lib DOM,ES2022 \
  assets/js/*.js
