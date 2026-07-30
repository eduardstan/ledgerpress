# Project agent memory

This file is the committed map of ledgerpress: the build, data boundary, release path, and
load-bearing constraints that should travel with the template.

## One record, two publications

`content/` is the whole adopter-owned interface. `content/README.md` documents it. The website in
`web/` and the PDF layout in `cv/cv.tex` both consume the same `content/cv.yaml`,
`content/publications.bib`, and `content/talks.bib`; posts and media live beside them. Adopting the
template must not require editing outside `content/`.

`web/src/lib/record.ts` owns the complete list of source paths. It locates the repository by walking
up for `content/cv.yaml`, the file no build can work without. `web/src/lib/record.test.ts` fails if a
record source points outside `content/`.

`scripts/build-cv-data.mjs` turns `content/cv.yaml` into the committed
`cv/generated/cv-data.tex`. Never hand-edit generated data. Every top-level list becomes a macro
family without the generator naming the section. Publication and talk grouping is declared under
`publications.sections` and `talks.sections`; no BibTeX type or grouping policy belongs in
`cv/cv.tex` or the website publication reader.

## Commands

- `npm test` runs the repository and website self-checks plus the generated-data freshness gate.
- `npm run build` regenerates CV data and builds the production website.
- `npm run dev` runs the local site; it forwards to the `web` package.
- `npm run check:format` is the Prettier gate; `npm test` does not cover formatting.
- `latexmk -xelatex -cd cv/cv.tex` builds the PDF. XeLaTeX is required.
- `bash scripts/check-cv-baseline.sh` compares the built PDF with `data/cv-baseline/`.
- `npm run check:adopter` creates a tracked-file-only copy, replaces only `content/`, and proves
  both the site and PDF cold start.

## Load-bearing constraints

- `web/public/.nojekyll` must reach the generated distribution; GitHub Pages otherwise strips Astro's `_astro`
  assets.
- `content/media/` is staged into the web public media build directory by the web package lifecycle. That destination
  is ignored build output, never source.
- `web/src/lib/cv.ts` uses Vite's `?raw` import because Astro relocates prerender bundles.
  Node-compatible schema and pure helpers stay in `web/src/lib/cv-schema.ts`.
- `web/src/lib/consistency.ts` fails production builds when two hand-authored dates on the same fact
  contradict. It walks every top-level list and never joins facts by matching prose.
- Counts, provenance, omissions, sorting views, announcements, and gaps are derived at build time.
  Do not replace them with hand-written numbers or copy.
- A zero-entry bibliography must skip its entire `refsection`; biber otherwise silently emits `[0]`
  labels. `\cvdeclare` and `\cvdeclarebib` keep missing sections safe for a minimal record.
- `scripts/check-deployment-base.mjs` builds its fixture-base proof into its own ignored throwaway
  directory and asserts `web/dist` is byte-identical afterwards. `web/dist` is the published
  artifact: a verification build must be structurally incapable of becoming it. It once rebuilt in
  place and the deploy published the fixture base with every check green.
- `web/public/fonts/LICENSES.md` travels unchanged with the bundled Ledger fonts.
- Root Prettier checks the whole repository with `.prettierrc`; keep nested configuration compatible.

## Ledger and ledgerpress

ledgerpress is the publishing product. Ledger is the design system in `web/src/styles/global.css`
and the bundled `LedgerSerif` faces. Keep those names distinct and intentional.

## Delivery

`.github/workflows/deploy.yml` builds the CV, runs its baseline, stages the PDF, builds the website,
and publishes the generated distribution to `gh-pages`. `.github/workflows/cv.yml` exposes the PDF
as a review artifact and runs the whole adopter cold start inside its pinned TeX environment. The
deploy workflow has no path filters because almost any tracked file can affect a build.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
No value that lives in another file may be restated here; point to the authoritative file or
command instead. Prefer rewriting or pruning existing entries over appending new ones. When
updating this file, preserve this bar for all agents and keep entries concise.

Keep `.claude/CLAUDE.md` as the single one-line import of this file for Claude-compatible tools.
Do not add another pointer at the repository root: having both pointers makes those tools load the
same instructions twice.
