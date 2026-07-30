# Printed CV baselines — fictional example

These baselines are the PDFs generated from the bundled fictional record. There is one per printed
document: the full CV and the two bundled variants, which are built from the same `content/` and so
move together when a fact changes.

Run:

```sh
latexmk -xelatex -cd cv/cv.tex        && bash scripts/check-cv-baseline.sh
latexmk -xelatex -cd cv/short.tex     && bash scripts/check-cv-baseline.sh cv/short.pdf
latexmk -xelatex -cd cv/teaching.tex  && bash scripts/check-cv-baseline.sh cv/teaching.pdf
```

The gate names its baseline after the PDF: `cv/short.pdf` is compared with `short-baseline.txt` and
`short-baseline-meta.txt`. It compares `pdftotext -layout` output with the first and the `pdfinfo`
page count with the second.

Baseline facts:

| Document          | Baseline            | Pages | Extracted text | Text SHA-256                                                       |
| ----------------- | ------------------- | ----- | -------------- | ------------------------------------------------------------------ |
| `cv/cv.pdf`       | `cv-baseline`       | 2     | 110 lines      | `59e3b1a3078a62e0c6c7e6b9fc4a079a6e90eeab25ca0c5cba189a9ae89c5716` |
| `cv/short.pdf`    | `short-baseline`    | 1     | 43 lines       | `90b3827b78b1314b880b6f36366f4495597aa796f38f7cba12585f693266dc8c` |
| `cv/teaching.pdf` | `teaching-baseline` | 1     | 56 lines       | `571d061a9c42424822e587d7553b5e53d2e857790e95618bd04fef19106e1f20` |

`cv-baseline.pdf` is retained for visual review of the full CV. The variants keep text and page
count only: the gate reads nothing else, and they share `cv/preamble.tex` with the full CV, so a
change to the printed design already shows up in a retained PDF.

When a deliberate record or layout change alters the output, rebuild the affected artefacts and
explain the user-visible reason in the commit. A changed generator is not by itself a reason to
accept a changed PDF.
