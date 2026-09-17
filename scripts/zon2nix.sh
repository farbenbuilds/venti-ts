#!/usr/bin/env bash
set -euo pipefail

if ! command -v zon2nix >/dev/null 2>&1; then
  echo "zon2nix not found; enter the dev shell with 'nix develop' first" >&2
  exit 1
fi

if [ "$#" -gt 0 ]; then
  zones=("$@")
else
  mapfile -t zones < <(git ls-files '*/build.zig.zon' 'build.zig.zon')
fi

if [ "${#zones[@]}" -eq 0 ]; then
  echo "zon2nix: no build.zig.zon files given or found" >&2
  exit 0
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

status=0
index=0

for zone in "${zones[@]}"; do
  if [ ! -f "$zone" ]; then
    echo "zon2nix: $zone not found" >&2
    status=1
    continue
  fi

  index=$((index + 1))
  before="$tmp/$index"
  mkdir -p "$before"

  for ext in nix json txt; do
    if [ -f "$zone.$ext" ]; then
      cp "$zone.$ext" "$before/$ext"
    fi
  done

  if ! zon2nix --16 "--nix=$zone.nix" "--json=$zone.json" "--txt=$zone.txt" "$zone"; then
    echo "zon2nix: failed to regenerate outputs for $zone" >&2
    status=1
    continue
  fi

  for ext in nix json txt; do
    if ! cmp -s "$zone.$ext" "$before/$ext"; then
      echo "zon2nix: regenerated $zone.$ext; stage the generated files and retry" >&2
      status=1
    fi
  done
done

exit "$status"
