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

# Whose record this baseline was taken from, recorded beside the page count
# rather than inferred from the PDF's layout: a change to cv.tex's header must
# not be able to decide whether this check runs. A different name means this is
# not a maintainer run at all, and saying so is more use than 110 lines of diff.
# Either name unreadable means nothing can be decided, and that fails.
trim_trailing() { sed -n '1s/[[:space:]]*$//p'; }
baseline_owner=$(sed -n 's/^Owner:[[:space:]]*//p' "$metadata" 2>/dev/null | trim_trailing)
record_owner=$(sed -n 's/^  name:[[:space:]]*//p' "$record" 2>/dev/null | trim_trailing)
# One layer of YAML quoting, so quoting style alone cannot look like a rename.
for quote in \" \'; do
  if [[ $record_owner == "$quote"*"$quote" ]]; then
    record_owner=${record_owner#"$quote"}
    record_owner=${record_owner%"$quote"}
    break
  fi
done

if [[ -z $baseline_owner ]]; then
  printf '%s\n' "$metadata names no \`Owner:\`, so this check cannot tell whose record $baseline was taken from. Add an \`Owner:\` line naming the record owner the baseline was built from." >&2
  exit 1
fi
if [[ -z $record_owner ]]; then
  printf '%s\n' "$record states no \`profile.name\`, so this check cannot tell whose record is in content/. Fix the record before comparing it with the baseline." >&2
  exit 1
fi

if [[ $record_owner != "$baseline_owner" ]]; then
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
