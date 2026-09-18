#!/usr/bin/env bash
set -euo pipefail

# Hygiene checks ported from the retired .pre-commit-config.yaml. Only staged
# files are inspected; fixes are left to oxfmt, zig fmt, and the author.

max_bytes=$((512 * 1024))
status=0

for file in "$@"; do
  if [ ! -f "$file" ]; then
    continue
  fi

  # Skip binaries; grep -I treats them as non-matching text.
  if [ -s "$file" ] && ! grep -Iq . "$file"; then
    continue
  fi

  if grep -nE '^(<{7}|={7}|>{7})( |$)' "$file" >/dev/null; then
    echo "hygiene: merge conflict marker in $file" >&2
    status=1
  fi

  if grep -nE '[[:space:]]+$' "$file" >/dev/null; then
    echo "hygiene: trailing whitespace in $file" >&2
    status=1
  fi

  if grep -q $'\r' "$file"; then
    echo "hygiene: CR line ending in $file" >&2
    status=1
  fi

  if [ -s "$file" ] && [ "$(tail -c 1 "$file" | wc -l)" -eq 0 ]; then
    echo "hygiene: missing final newline in $file" >&2
    status=1
  fi

  if [ "$(wc -c < "$file")" -gt "$max_bytes" ]; then
    echo "hygiene: file larger than 512 KiB: $file" >&2
    status=1
  fi
done

exit "$status"
