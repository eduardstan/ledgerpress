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
| `cv/cv.pdf`       | `cv-baseline`       | 3     | 123 lines      | `c5935d4aa57d4a2d4c242162d64a1fa4bbfc965515131eb66162418f47cd2431` |
| `cv/short.pdf`    | `short-baseline`    | 1     | 43 lines       | `92b41fffe9f82491717fdedaf0932971e4954a8052e88938e0c1b4069402a190` |
| `cv/teaching.pdf` | `teaching-baseline` | 1     | 56 lines       | `8a94643dd7a22698025c3fea33c517cf3cbec0f2a98c16fcefbdea5823612d2c` |

Every `*-baseline-meta.txt` also records `Owner:`, the `profile.name` its baseline was built from.
The gate runs only while `content/cv.yaml` still states that name; a different name is an adopted
record and skips with one line, and a name that cannot be read on either side fails rather than
skipping, so no layout change and no parsing defect can silently disable it.

Owner for all three baselines: Sahana Aster KŌWHAI, Ph.D.

`cv-baseline.pdf` is retained for visual review of the full CV. The variants keep text and page
count only: the gate reads nothing else, and they share `cv/preamble.tex` with the full CV, so a
change to the printed design already shows up in a retained PDF.

When a deliberate record or layout change alters the output, rebuild the affected artefacts and
explain the user-visible reason in the commit. A changed generator is not by itself a reason to
accept a changed PDF.

## Re-recording one baseline

Build the document first, then write the two files the gate reads, named after the PDF:

```sh
pdftotext -layout cv/short.pdf data/cv-baseline/short-baseline.txt
pdfinfo cv/short.pdf | grep '^Pages:' > data/cv-baseline/short-baseline-meta.txt
```

For the full CV also refresh the retained artefact, `cp cv/cv.pdf data/cv-baseline/cv-baseline.pdf`.
Then update that document's row in the table above: `wc -l` the text file for the line count and
`shasum -a 256` it for the digest.
