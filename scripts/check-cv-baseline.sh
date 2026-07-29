#!/usr/bin/env bash

set -uo pipefail

pdf=${1:-cv/cv.pdf}
baseline=data/cv-baseline/cv-baseline.txt
metadata=data/cv-baseline/cv-baseline-meta.txt
failed=0

if ! pdftotext -layout "$pdf" - | diff -u "$baseline" -; then
  failed=1
fi

expected_pages=$(awk '$1 == "Pages:" { print $2 }' "$metadata")
actual_pages=$(pdfinfo "$pdf" | awk '$1 == "Pages:" { print $2 }')
if [[ ! $expected_pages =~ ^[0-9]+$ || $actual_pages != "$expected_pages" ]]; then
  printf 'Expected %s CV pages, found %s.\n' "${expected_pages:-an invalid count}" \
    "${actual_pages:-no count}" >&2
  failed=1
fi

log=${pdf%.pdf}.log
if [[ -f $log ]]; then
  # academicons emits one harmless warning for the ordinary space separating
  # two profile icons. Every other missing glyph is a real Unicode regression.
  missing_glyphs=$(
    grep 'Missing character:' "$log" |
      grep -vE 'U\+0020.*academicons' || true
  )
  if [[ -n $missing_glyphs ]]; then
    printf 'The CV log reports missing glyphs:\n%s\n' "$missing_glyphs" >&2
    failed=1
  fi
fi

if ((failed)); then
  printf '%s\n' \
    'The CV baseline differs: this is either a real regression or an intended change that must be recorded in data/cv-baseline/README.md.' >&2
  exit 1
fi
