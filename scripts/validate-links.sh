#!/usr/bin/env bash
set -euo pipefail

if ! command -v rg >/dev/null 2>&1; then
  echo "ripgrep (rg) is required" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

missing_count=0

for file in *.html ar/*.html bn/*.html ur/*.html; do
  dir="$(dirname "$file")"

  while IFS= read -r attr; do
    ref="${attr#*=\"}"
    ref="${ref%\"}"

    case "$ref" in
      "" | http://* | https://* | mailto:* | \#* | javascript:*)
        continue
        ;;
    esac

    if [[ "$ref" == /* ]]; then
      resolved=".$ref"
    else
      resolved="$dir/$ref"
    fi

    if [[ ! -e "$resolved" ]]; then
      echo "Missing reference: $file -> $ref"
      missing_count=$((missing_count + 1))
    fi
  done < <(rg -oN '(href|src)="[^"]+"' "$file" || true)
done

if [[ $missing_count -gt 0 ]]; then
  echo "Found $missing_count missing local reference(s)." >&2
  exit 1
fi

echo "All local href/src references resolve successfully."
