#!/usr/bin/env bash
#
# A MAINTAINER check. It compares the built PDF against the baseline taken from
# the bundled example record, so it can only pass while `content/` still holds
# that record. It is not one of the adopter checks in README.md, and an adopted
# record is expected to differ rather than to have regressed.

set -uo pipefail

# Each printed document has its own baseline, named after it: cv/cv.pdf against
# cv-baseline.txt, cv/short.pdf against short-baseline.txt. The variants are
# built from the same record as the full CV, so a fact edit that breaks one
# breaks all of them, and each needs its own recorded text and page count.
pdf=${1:-cv/cv.pdf}
name=$(basename "$pdf" .pdf)
record=content/cv.yaml
baseline=data/cv-baseline/$name-baseline.txt
metadata=data/cv-baseline/$name-baseline-meta.txt
failed=0

# A document that was never built is a maintainer who has not built it yet, and
# saying so beats pdftotext's error on a missing file.
if [[ ! -f $pdf ]]; then
  printf '%s\n' "$pdf has not been built yet. Build it first: latexmk -xelatex -cd cv/$name.tex" >&2
  exit 1
fi

# Whose record this is, read from the two files themselves rather than written
# down anywhere: the baseline's first line is the printed name, and `profile.name`
# is where that name came from. A different name means this is not a maintainer
# run at all, and saying so is more use than 110 lines of diff.
baseline_owner=$(sed -n '1{s/^[[:space:]]*//;s/[[:space:]]*$//;p;}' "$baseline" 2>/dev/null)
record_owner=$(sed -n 's/^  name:[[:space:]]*//p' "$record" 2>/dev/null | head -1)
record_owner=${record_owner%\"}
record_owner=${record_owner#\"}
if [[ -n $baseline_owner && -n $record_owner && $record_owner != "$baseline_owner" ]]; then
  printf '%s\n' \
    "Skipped: this maintainer check compares $pdf with the baseline of the bundled example record ($baseline_owner), and $record now holds a different person ($record_owner) — an adopted record is expected to differ, so there is nothing here to verify. The checks that do apply to your record are under \"Validation\" in README.md; \`npm run check\` runs all of them."
  exit 0
fi

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
