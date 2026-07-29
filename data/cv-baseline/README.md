# Printed CV baseline — fictional example

This baseline is the PDF generated from the bundled fictional record.

Run:

```sh
latexmk -xelatex -cd cv/cv.tex
bash scripts/check-cv-baseline.sh
```

The gate compares `pdftotext -layout` output with `cv-baseline.txt` and the `pdfinfo` page count
with `cv-baseline-meta.txt`. `cv-baseline.pdf` is retained for visual review.

Baseline facts:

- Pages: 2
- Extracted text: 110 lines
- Text SHA-256: `59e3b1a3078a62e0c6c7e6b9fc4a079a6e90eeab25ca0c5cba189a9ae89c5716`

When a deliberate record or layout change alters the output, rebuild all three artefacts and
explain the user-visible reason in the commit. A changed generator is not by itself a reason to
accept a changed PDF.
