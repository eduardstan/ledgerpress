# Project agent memory

This file is the committed map of ledgerpress: the build, data boundary, release path, and
load-bearing constraints that should travel with the template.

## One record, several publications

`content/` owns the record: every fact about the adopter, and which sections the CV prints.
`content/README.md` documents it. The website in `web/` and every printed document in `cv/` consume
the same `content/cv.yaml`, `content/publications.bib`, and `content/talks.bib`; posts and media live
beside them. Replacing the record must not require editing outside `content/` — that is what
`npm run check:adopter` proves.

Design is code, deliberately: the theme, the printed layout and its curated section headings, routes,
redirects and announcement wording are all edited outside `content/`, and `README.md`'s "Make it
yours" lists where. Do not move any of them into `content/`: that was considered and rejected,
because layout and routes cannot follow and the boundary would blur again. The boundary is facts
versus design — keep every document saying the same thing about it.

Three documents are printed: `cv/cv.tex`, `cv/short.tex` and `cv/teaching.tex`. `cv/preamble.tex`
holds every package, style and macro they share; a block too particular for a macro is a body
fragment they `\input`, as `cv/header.tex` (the contact block) and `cv/supervision.tex` (that
hand-set section) are. The printed design is therefore written once, and a document body is only
which sections it curates, in what order, and how many entries of each. No fact is repeated per
variant, and none may be: a variant carrying its own copy of an appointment breaks the premise.
Three things a document may set for itself instead of editing the shared layout — `\cvtypeface`,
`\cvcoursecols` and `\cvsourcemaps`, defined before its `\input{preamble.tex}`; README.md's "Three
printed-CV settings a document carries itself" documents them and `cv/preamble.tex` explains each
where it is read. They exist so an adopter with a forked `cv/preamble.tex` can drop the fork. Each is
`\providecommand`ed to today's look, so the bundled example is unaffected, and no check asserts any
of them. Do not grow the set into a theming system: a fourth setting needs the same evidence, a real
fork that a shared layout otherwise cannot absorb.
Only `cv/cv.tex` prints `\cvAutoSections`: a variant is a curated subset, so printing every section
the body did not name is what it exists not to do — it still honours `printed: false`, because it
reaches every section through `\cvpart`. What belongs to a variant is layout — including the entry
count on `\cvpart` and any `\defbibfilter` only that document prints. What belongs to the record is
curation, marked on the fact itself, as `selected` is in `content/publications.bib`. A section
declared under `publications.sections` for one document's sake changes the full CV and the website,
because each section subtracts the ones declared before it.

`web/src/lib/record.ts` owns the complete list of source paths. It locates the repository by walking
up for `content/cv.yaml`, the file no build can work without. `web/src/lib/record.test.ts` fails if a
record source points outside `content/`.

`scripts/build-cv-data.mjs` turns `content/cv.yaml` into the committed
`cv/generated/cv-data.tex`. Never hand-edit generated data. Every top-level list becomes a macro
family without the generator naming the section, and `\cvAutoSections` carries the printed section
sequence, so a section added to the record reaches the PDF with no `.tex` edit: `cv/cv.tex` prints
that sequence and skips the keys it lays out by hand, which `\cvdeclare` records.
Publication and talk grouping is declared under
`publications.sections` and `talks.sections`; no BibTeX type or grouping policy belongs in
`cv/cv.tex` or the website publication reader.

## Commands

- `npm run check` runs every adopter check. Each one passes on any valid record; a check that can
  only pass on the bundled example belongs under `npm run check:maintainer` instead. README.md
  documents which set an adopter runs. It regenerates `cv/generated/cv-data.tex` first — the one
  tracked file any check writes — and announces that it does, because the checks after it compare
  that file with the record. `npm test` keeps the freshness gate unchanged, so an uncommitted
  regeneration still fails CI.
- `npm test` runs the repository and website self-checks plus the generated-data freshness gate.
- `npm run build` regenerates CV data and builds the production website.
- `npm run dev` runs the local site; it forwards to the `web` package.
- `npm run check:format` is the Prettier gate; `npm test` does not cover formatting.
- `latexmk -xelatex -cd cv/cv.tex` builds a PDF; the same for `cv/short.tex` and `cv/teaching.tex`.
  XeLaTeX is required.
- `npm run check:maintainer` compares every built PDF with the `data/cv-baseline/` entry named after
  it; `bash scripts/check-cv-baseline.sh [pdf]` checks one. It is the one check tied to the bundled
  example, and it skips with one line once `content/` names someone else. It decides that from
  `Owner:` in that PDF's `*-baseline-meta.txt` against `profile.name`, and fails rather than skips
  when either is unreadable, so a layout change cannot silence it.
  `data/cv-baseline/README.md` lists all three baselines and how to re-record one.
- `npm run check:adopter` creates a tracked-file-only copy, replaces only `content/`, and proves
  both the site and PDF cold start.

## Load-bearing constraints

- `web/public/.nojekyll` must reach the generated distribution; GitHub Pages otherwise strips Astro's `_astro`
  assets.
- `content/media/` is staged into the web public media build directory by the web package lifecycle. That destination
  is ignored build output, never source.
- `web/src/lib/cv.ts` uses Vite's `?raw` import because Astro relocates prerender bundles.
  Node-compatible schema and pure helpers stay in `web/src/lib/cv-schema.ts`.
- `readCv` in `web/src/lib/cv-schema.ts` is the one boundary every website reader of
  `content/cv.yaml` crosses, `profile:` included: nothing under `web/` may parse that file a second
  time. It coerces YAML scalars to text and rejects anything else by naming the file, the field path
  and what was expected. A schema failure that does not name the field is a bug in that function.
  Plain-Node scripts outside `web/` are outside this website boundary;
  `scripts/build-cv-data.mjs` parses the record itself and coerces with `String()` where it renders.
- The website self-checks read `web/src/lib/fixtures/record/`, not `content/`; that directory's
  README states the rule. Only `web/src/lib/live-record.test.ts` reads the real record, and
  everything in it must hold for any valid record.
- `web/src/lib/consistency.ts` fails production builds when two hand-authored dates on the same fact
  contradict. It walks every top-level list and never joins facts by matching prose.
- Counts, provenance, omissions, sorting views, announcements, and gaps are derived at build time.
  Do not replace them with hand-written numbers or copy.
- A `\printbibliography` whose filter matches nothing prints nothing at all, its own heading
  included. Under a hand-written `\section` that leaves a title over silence, so every hand-written
  filtered block goes through `\cvbibfiltered` (`cv/preamble.tex`), which names the filter that
  matched nothing instead of failing the build. The generated sections are exempt and must stay so.
- A zero-entry bibliography must skip its entire `refsection`; biber otherwise silently emits `[0]`
  labels. `\cvdeclare` and `\cvdeclarebib` keep missing sections safe for a minimal record, and
  `scripts/build-cv-data.test.mjs` proves every document names only macros they define.
- `scripts/check-deployment-base.mjs` builds its fixture-base proof into its own ignored throwaway
  directory and asserts the generated distribution is byte-identical afterwards. That distribution is
  what the deploy publishes, so a verification build must be structurally incapable of becoming it.
  It once rebuilt in place and the deploy published the fixture base with every check green.
- No adopter-facing check may assert something an adopter is invited to change, and no build may
  fail over branding, credit, typography or presentation. Checks are for correctness: a lost
  deployment base, a broken link, a contradictory fact, an artifact the code itself promises. Where
  a property depends on the record or on an optional artifact, derive the subjects from the build
  output or guard the assertion behind the thing it checks — never add a flag, manifest or config
  surface to describe what is optional. `scripts/check-deployment-base.mjs` is the worked example:
  it names no font and requires no printed CV.
- `web/public/fonts/LICENSES.md` travels unchanged with the bundled Ledger fonts.
- Root Prettier checks the whole repository with `.prettierrc`; keep nested configuration compatible.

## Ledger and ledgerpress

ledgerpress is the publishing product. Ledger is the design system in `web/src/styles/global.css`
and the bundled `LedgerSerif` faces. Keep those names distinct and intentional.

## Delivery

`.github/workflows/deploy.yml` builds all three printed documents, runs each baseline, stages them
into the website's ignored assets directory as `cv.pdf` and `cv-<variant>.pdf`, builds the website,
and publishes the generated distribution to `gh-pages`. `/cv/` links the full CV as the primary
download and the variants beside it, each offered only when its file is really staged; `.gitignore`
lists the three staged names.
`.github/workflows/cv.yml` builds the same three for review, checks each baseline, exposes them as
artifacts, and runs the whole adopter cold start inside its pinned TeX environment. The two must
agree on the set — a document only one of them builds either never reaches a reader or reaches one
unreviewed — and `scripts/build-cv-data.test.mjs` fails when they disagree. The deploy workflow has
no path filters because almost any tracked file can affect a build.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
No value that lives in another file may be restated here; point to the authoritative file or
command instead. Prefer rewriting or pruning existing entries over appending new ones. When
updating this file, preserve this bar for all agents and keep entries concise.

Keep `.claude/CLAUDE.md` as the single one-line import of this file for Claude-compatible tools.
Do not add another pointer at the repository root: having both pointers makes those tools load the
same instructions twice.
