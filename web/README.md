# The ledgerpress website

This is the Astro publication surface for the adopter-owned record in `../content/`. Run it from
this directory with:

```sh
npm ci
npm run dev
npm test
npm run check
npm run build
```

Astro 7 requires Node.js 22.12 or newer.

## Architecture

| Path                       | Responsibility                                                 |
| -------------------------- | -------------------------------------------------------------- |
| `src/lib/record.ts`        | BibTeX, talks, posts, identity and provenance readers          |
| `src/lib/cv.ts`            | Vite-inlined `content/cv.yaml` reader for pages                |
| `src/lib/cv-schema.ts`     | Shared schema boundary, shapes and pure grouping helpers       |
| `src/lib/announcements.ts` | One generated announcement stream for home, `/lately/` and RSS |
| `src/lib/consistency.ts`   | Production contradiction gate                                  |
| `src/lib/inline.ts`        | Shared inline markup grammar                                   |
| `src/lib/urls.ts`          | Canonical and project-subpath URL boundary                     |
| `src/styles/global.css`    | The Ledger design system                                       |
| `src/pages/`               | Static routes                                                  |

Every rendered count and source line is derived. The **Inspect sources** switch reveals provenance
without JavaScript; do not replace those records with hand-written summaries.

## Content and media

`../content/README.md` owns the adopter interface. `npm run stage-media` copies
`../content/media/` into the public directory before dev, build and preview. The destination is
ignored build output. `public/.nojekyll` is load-bearing for GitHub Pages because its legacy Jekyll
pass would otherwise strip Astro's `_astro` directory.

## Publications

The publication index displays every BibTeX entry. Group names and predicates come from
`content/cv.yaml`; an undeclared type remains visible as `Other`. The same declarations generate
biblatex filters, so the website and PDF are tested for first-match-wins agreement.

Website-only bibliography fields such as `abstract`, `html`, `pdf` and `selected` are accepted.
Absolute `html`/`pdf` addresses are followed as written; relative values point under `/assets/`.

## Markdown

The site opts into Astro's unified Markdown processor so remark/rehype plugins can render math.
Posts may use Markdown or MDX and KaTeX. The small inline grammar used inside YAML is deliberately
separate: `**bold**`, `_italic_` and `[text](url)`.

## Design

Ledger uses three local font roles: Archivo Black for display, Ledger Serif for prose and Go Mono
for apparatus. Light/dark colour tokens live at the top of `src/styles/global.css`. There is no
analytics or visitor tracking.

## Build behaviour

`astro.config.mjs` reads `profile.site` for canonical URLs and the deployment base, then runs the
consistency gate after a production build. Development never refuses a contradiction; the inspect
record shows it while the author works. The production build fails before anything can be
published.

The deploy workflow builds the printed CVs first and stages them at `public/assets/cv.pdf`,
`cv-short.pdf` and `cv-teaching.pdf`; a plain local site build omits each download rather than
offering a stale file, and `/cv/` offers only the ones really staged.
