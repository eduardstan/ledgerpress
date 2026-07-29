# Your CV and your website, from one file, that cannot disagree.

ledgerpress turns one academic record into a searchable website and a typeset PDF CV. Drop in the
BibTeX you already have, edit only `content/`, and every publication, date, count, feed item and
source note is rebuilt from the same facts.

The website lets a reader turn on **Inspect sources** and see where every claim came from. The
production build goes further: if two hand-written dates on one fact contradict, it refuses to
publish.

## Why ledgerpress

- **Import wins adoption.** Replace `content/publications.bib` with a Zotero, Mendeley, DBLP or
  Google Scholar export. Journal articles, chapters, books, datasets and other BibTeX types render
  without transcription.
- **CV variants win the argument.** Facts and layout are separate. Keep one record, then make a
  teaching, grant or short CV by copying the LaTeX layout and choosing different generated section
  macros—without copying a single appointment or publication.
- **The record balances.** Publication groups are declared once and drive both the website's type
  column and the PDF's headings and numbering.
- **The gaps stay visible.** Missing dates, unmatched publication types and omitted sections appear
  in generated provenance instead of being silently invented.
- **It is a real site, not a CV pasted into HTML.** Blog posts, RSS, sitemap, search, dark mode,
  responsive layouts, accessible navigation and GitHub Pages deployment are included.

The name is literal: a **ledger** is the record kept once and required to balance; the **press**
publishes it. The product is **ledgerpress**. **Ledger** is the design system inside it—the
high-contrast editorial interface in `web/`, including the Ledger Serif type family.

## See the example

The repository opens with Dr. Sahana Aster Kōwhai, a fictional palaeoclimatologist in Aotearoa New
Zealand. Her record deliberately exercises cross-appointments, non-ASCII names, several BibTeX
types, talks, teaching tables, projects, service, fieldwork, a post and a non-photographic SVG
portrait.

The example record is fictional. Your own record and media remain yours.

## Start in ten minutes

Use GitHub's **Use this template** button, create a repository, then:

```sh
git clone https://github.com/YOUR-NAME/YOUR-REPOSITORY.git
cd YOUR-REPOSITORY
git remote add ledgerpress https://github.com/eduardstan/ledgerpress.git
git fetch ledgerpress
npm ci
npm ci --prefix web
```

This is the quickest route: GitHub gives the new repository a clean one-commit history rather than
ledgerpress's history. That means its first upstream update must explicitly join unrelated
histories, as documented below. Choose the history-preserving fork or clone route instead if clean
ongoing merges matter more than a fresh history, especially before customising machinery. If
GitHub does not show the button, use that history-preserving route.

You need Node.js 22.12 or newer. Building the PDF locally also needs XeLaTeX, biber and latexmk;
checking it against the included baseline additionally needs Poppler's `pdftotext`/`pdfinfo`. The
GitHub workflows provide all of those tools in CI.

Now replace the example:

1. Edit `content/cv.yaml`.
2. Replace `content/publications.bib` and `content/talks.bib`.
3. Replace `content/posts/` and `content/media/`.
4. Leave everything outside `content/` alone for the first build.

The complete field reference, a smallest working record and BibTeX grouping examples live in
[`content/README.md`](content/README.md).

Run the website:

```sh
npm --prefix web run dev
```

Build the PDF:

```sh
npm run build:cv-data
latexmk -xelatex -cd cv/cv.tex
```

Build the production site:

```sh
npm run build
```

The PDF is written to `cv/cv.pdf`. The website is written to `web/dist/`.

## Before you publish: privacy checklist

- Replace the example name, biography, email, affiliations, links and `profile.site`.
- Replace every `.bib` entry; inspect abstracts, file paths, notes and private attachment URLs.
- Delete example posts and media you do not want.
- Use a portrait you own or have permission to publish. Record its licence.
- Decide whether a street address, room number, personal email or phone number should be public.
- Search the repository and the built output for the previous person's name and domain.
- Open the PDF and every website route before pushing.
- Run the cold-start proof below.

Do not solve a missing fact by guessing it. Omit the field; ledgerpress is designed to show honest
gaps.

## Validation

```sh
npm test
npm --prefix web run check
npm --prefix web run build
npm run check:deployment-base
npm run check:adopter
latexmk -xelatex -cd cv/cv.tex
bash scripts/check-cv-baseline.sh
npx prettier . --check
```

`npm run check:adopter` is the decisive test. It creates a clean tracked-file-only copy, replaces
only `content/` with a second synthetic scholar, and builds both the website and PDF. If that
requires an edit anywhere else, the check fails.

The PDF baseline lives in `data/cv-baseline/`. When a deliberate content or layout change moves
text or pages, rebuild the baseline and explain why in that directory's README.

## Deploy on GitHub Pages

The deploy workflow builds and validates both outputs, stages the fresh PDF into the site, and
publishes `web/dist/` to the `gh-pages` branch.

In the repository settings:

1. Set `profile.site` to the exact published URL, including `/YOUR-REPOSITORY/` for a GitHub project
   site.
2. Open **Pages**.
3. Choose **Deploy from a branch**.
4. Select `gh-pages` and `/ (root)`.
5. Keep Actions enabled.

Push to `main`, or run **Deploy site** from the Actions tab. Pull requests run every build and gate
without publishing.

## Make it yours after the first green build

All personal facts stay in `content/`. Machinery customisation is optional:

- Edit `web/src/styles/global.css` to change Ledger's colours, type and layout.
- Edit `cv/cv.tex` to change the printed layout.
- Add migration redirects in `web/src/lib/legacy-urls.ts`.
- Change website routes in `web/src/pages/`.

To make a CV variant, copy the layout—not the record:

```sh
cp cv/cv.tex cv/teaching.tex
# In cv/teaching.tex, keep or reorder the \cvpart lines needed for this version.
latexmk -xelatex -cd cv/teaching.tex
```

Both layouts still input `cv/generated/cv-data.tex`, so a later fact edit reaches every variant.

## Take later ledgerpress improvements

Keep ledgerpress as a read-only second remote in your personal site. Template improvements flow in;
personal data never flows out. Choose one route and keep it: the template route starts fastest but
has one unrelated-history update; a fork or history-preserving clone keeps ancestry and makes every
update an ordinary merge.

### If you used **Use this template**

The setup above already added the remote. For the first update, join the two histories, take the
upstream machinery side of their initial add/add conflicts, and then restore your record before
committing:

```sh
git switch main
git pull --ff-only
git fetch ledgerpress
git merge --allow-unrelated-histories --no-commit --no-ff -X theirs ledgerpress/main
git restore --source=HEAD --staged --worktree content/
git diff --check
git diff --stat HEAD
git commit -m "chore: connect ledgerpress updates"
npm ci
npm ci --prefix web
npm test
npm run check:adopter
```

`-X theirs` is deliberate only for this first unrelated merge: it takes ledgerpress's current
machinery while the following `git restore` keeps your `content/`. Review the remaining diff before
committing; if you have already customised machinery, use the history-preserving route below or
resolve those files by hand.

If you recorded the ledgerpress commit used to create your template, you may take only later
upstream commits instead of joining histories. Replace the two values below with that recorded
commit and the last commit you want, then run:

```sh
LEDGERPRESS_BASE=<RECORDED-TEMPLATE-COMMIT>
LEDGERPRESS_LAST=<LAST-UPSTREAM-COMMIT>
git fetch ledgerpress
git cherry-pick --no-commit "$LEDGERPRESS_BASE".."$LEDGERPRESS_LAST"
git restore --source=HEAD --staged --worktree content/
git diff --check
git commit -m "chore: take ledgerpress improvements"
```

That cherry-pick route deliberately does not create shared ancestry. Record the new last commit and
repeat from it next time.

After the first unrelated merge, every later update uses the ordinary merge recipe in the next
section.

### If you want history-preserving updates

Either fork ledgerpress on GitHub and clone your fork:

```sh
git clone https://github.com/YOUR-NAME/YOUR-FORK.git YOUR-REPOSITORY
cd YOUR-REPOSITORY
git remote add ledgerpress https://github.com/eduardstan/ledgerpress.git
git fetch ledgerpress
```

Or create an empty repository of your own, then preserve ledgerpress's history while assigning the
two remotes explicitly:

```sh
git clone https://github.com/eduardstan/ledgerpress.git YOUR-REPOSITORY
cd YOUR-REPOSITORY
git remote rename origin ledgerpress
git remote add origin https://github.com/YOUR-NAME/YOUR-REPOSITORY.git
git push -u origin main
```

Replace only `content/`, commit it to your own `origin`, and use this recipe for every update (and
for every template-route update after its first merge):

```sh
git switch main
git pull --ff-only
git fetch ledgerpress
git merge --no-commit --no-ff ledgerpress/main
git restore --source=HEAD --staged --worktree content/
git diff --check
git diff --stat HEAD
git commit -m "chore: take ledgerpress improvements"
npm ci
npm ci --prefix web
npm test
npm run check:adopter
```

The `git restore` line deliberately puts your current `content/` back before the merge commit. Read
the remaining diff: it should be machinery only. Resolve any non-content conflict, rebuild both
outputs, then push to your own remote. Never push your personal branch to the `ledgerpress` remote.

## How it works

```text
content/cv.yaml ───────┬──> Astro readers ──> website, search, RSS, provenance
                       └──> CV generator ───> generated LaTeX ──> PDF

content/publications.bib ──> publication index + announcement register + PDF groups
content/talks.bib ─────────> talks page + announcement register + PDF groups
content/posts/ ────────────> blog + announcement register + RSS
```

The important contracts are kept executable:

- the generator rejects stale generated data and malformed table rows;
- tests prove website and biber grouping agree, first match wins, and empty bibliographies stay safe;
- the consistency gate compares duplicate dates within the same record;
- the adopter check proves a new person does not inherit the example;
- the baseline gate protects the printed result, not byte-identical build artefacts.

## Roadmap

- Structured importers are coming; none is claimed here today.
- An existing LaTeX or PDF CV can realistically be transcribed by giving it and
  `content/README.md` to an assistant, then reviewing every resulting fact. That is not a supported
  import route yet: a generative step sits between source facts and a public claim, so ledgerpress
  ships no official prompt or verification checklist and promises no automatic accuracy.
- First-class named variant configuration can make the layout-copy workflow above more convenient
  while preserving one factual record.

## Licence

The machinery is MIT licensed; see [`LICENSE`](LICENSE). Bundled web fonts retain their own licences
in [`web/public/fonts/LICENSES.md`](web/public/fonts/LICENSES.md).
