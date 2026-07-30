# `content/` — the adopter-owned records and media

This directory owns every structured record and media asset about you.

```
content/
  cv.yaml            you, and every section of your CV
  publications.bib   standard BibTeX
  talks.bib          standard BibTeX
  posts/             blog posts, Markdown with front matter
  media/             portrait, favicon and post images
```

Two consumers read it: the website (`web/`) and the printed CV (`cv/cv.tex`, via
`npm run build:cv-data`). Neither has a second copy of anything.

A few fields reach only one of the two. Every such case is stated where the field is documented, and
[collected in one table](#where-the-misleading-fields-land).

**The fastest way in:** copy the example below into `cv.yaml`, put an empty `publications.bib` and
`talks.bib` beside it, and run the two builds. You get a one-page CV and a working site. Then grow it
— starting with your own BibTeX export, which needs no conversion at all.

## The smallest file that works

```yaml
profile:
  name: Alex Newcomer
  site: https://alex-newcomer.example/
  headline: Postdoctoral Researcher
  affiliation:
    - label: University of Somewhere
  place: Somewhere, Elsewhere
  email: alex@example.edu
  bio:
    short: Alex Newcomer is a postdoctoral researcher at the University of Somewhere.

appointments:
  - title: Postdoctoral Researcher
    org: University of Somewhere
    dates: 2025 – Present
```

## Bring the publications you already have

**Drop your BibTeX file in as `publications.bib`. That is the whole import.** It is the largest
block of an academic CV and it costs nothing: an untouched DBLP export for a stranger — 26 entries,
not one edit — renders complete on the site (authors, venue, pages, DOI link, copy-BibTeX block)
_and_ prints in the PDF, grouped and numbered. Zotero, Mendeley and Google Scholar write the same
format. `talks.bib` works the same way. Two things to know before you read the result:

**Declare your sections, or every entry is labelled `Other`.** Nothing about grouping is built in —
which type belongs under which heading is your opinion and you write it down
([how they are grouped](#how-they-are-grouped-publications-and-talks-in-cvyaml)). Paste this beside
the example above and refine it once you can see your own list:

```yaml
publications:
  sections:
    - { title: Journal articles (peer-reviewed), short: Journal, types: [article] }
    - { title: Conference papers (peer-reviewed), short: Conference, types: [inproceedings] }
    - { title: Books & chapters, short: Books, types: [incollection, inbook, book] }

talks:
  sections:
    - { title: Talks, short: Talk, types: [unpublished] }
```

(`inbook` is in there because Crossref emits it for conference papers published in LNCS. Without it
those land in `Other`. Declaring a section for a file you have not filled in yet costs nothing: a
`.bib` with no entries prints no bibliography at all.)

**DBLP escapes the underscores in `doi`, and the PDF prints the backslash.** It writes
`doi = {10.1007/978-3-319-07857-1\_33}`; the site strips the escape, the PDF prints it literally and
its DOI link carries `%5C_`. Until that is fixed for everyone, unescape them yourself:

```sh
sed -i '/doi *=/ s/\\_/_/g' content/publications.bib
```

It is a known upstream blemish — not something you did wrong.

## `profile:`

```yaml
profile:
  name: Ada LOVELACE, Ph.D.     # exactly as printed at the top of the CV, and as
                                # the site's masthead. Surname capitalised and a
                                # degree appended are conventions, not rules —
                                # write your name the way you want it set.
  site: https://ada.example/    # final published URL. Include a project path,
                                # e.g. https://name.github.io/repository/, when
                                # the site is not served from the origin root.
                                # A trailing slash is optional: only the origin
                                # and the path are read, and the path is
                                # normalised, so `.../repository` and
                                # `.../repository/` are the same deployment.
                                # A query string or fragment is refused.
                                # WEBSITE only — the PDF never reads it.
  headline: Reader in Analytical Engines        # your role, alone. No institution.
  affiliation:                  # smallest unit first: group, then department,
    - label: Analytical Engine Group            # then institution. A list, so a
      url: https://example.ac.uk/aeg            # cross-appointment can be stated
    - label: University of Example              # without changing the shape.
      url: https://example.ac.uk/
  place: London, WC1E, United Kingdom           # city, postcode, country
  address:                      # street-level lines. The WEBSITE footer only —
    - 5 Example Street          # the printed CV never carries them. Omit it and
    - Room 12                   # the footer prints the affiliations and `place`.
  email: ada@example.ac.uk
  website:                      # a page about you that ISN'T this site — your
    label: ada.example.com      # staff page, your lab. Omit it if you have none.
    url: https://ada.example.com/             # NOT a synonym for `site` above:
                                # `site` is where THIS record is published, and
                                # `website` is somewhere else. It is printed in
                                # the CV's header block and the website does not
                                # render it; `links` below reaches both.
  links:                        # known kinds take compact account IDs:
    orcid: 0000-0002-1825-0097  # scholar, orcid, github and linkedin
    github: adalovelace
    bluesky:                    # every other service takes a label and URL;
      label: Bluesky            # the site and PDF both render it without a
      url: https://bsky.app/profile/ada.example # machinery edit.
  portrait: portrait.jpg        # a file in content/media/
  favicon: favicon.svg          # another file in content/media/. Optional: if it
                                # is omitted or missing, no icon link is emitted.
  bio:
    short: >-                   # THIRD person, one paragraph. Printed as the CV's
                                # "Short Bio", and shown under the same heading on
                                # the site's /cv/ page. NOT a shortened `long`:
                                # the two differ in grammatical person and in
                                # where they appear, not in length.
      Ada Lovelace is a Reader in ...
    long: >-                    # FIRST person, several paragraphs. The site's
                                # front page shows all of it, and quotes the first
                                # sentence above the fold. The CV does not print
                                # it, and no other page shows it.
                                # `>-` FOLDS: wrap at 80 columns freely and
                                # separate paragraphs with a blank line. (`|-`
                                # would keep every wrap as a hard line break.)
      I work on ...

      My group ...
  focus: >-                     # One paragraph, the CV's "Research Focus". This is
                                # the technical statement — subject, method,
                                # application. `bio.short` is the career summary;
                                # this is the work. If you find yourself writing
                                # the same sentence twice, omit this one: the
                                # heading disappears with it.
    Analytical engines, with an emphasis on ...
  footer: >-                    # printed small at the foot of the CV. Where a data
                                # protection or GDPR consent clause goes. Omit it
                                # and nothing is printed.
    **Data protection and permitted use.** I authorize the processing of ...
```

`name` is the only field the CV data shape requires. The website build also requires `site`,
because it cannot publish honest canonical, feed and sitemap URLs without knowing its origin.

The address block under your name on the CV is built as: `headline, affiliation[0]`, then each
further affiliation, with `place` appended to the last one. With one affiliation it is a single
line.

## A section

A section is a top-level key holding a list. (`publications:` and `talks:` hold `sections:`
instead of entries — they group the two BibTeX files and are documented further down.) Every field
except `title` is optional:

```yaml
appointments:
  - title: Reader in Analytical Engines   # what it was
    org: University of Example            # where it was
    place: London, United Kingdom         # the city
    dates: Mar 2024 – Present             # when. Any spelling you like, but use
                                          # the SAME one everywhere — nothing
                                          # normalises it and two spellings in
                                          # one CV show.
    detail: Analytical Engine Group       # one line more. The PDF wraps a long
                                          # second line while keeping dates and
                                          # place in their right-hand column.
    url: https://example.ac.uk/           # the site links `org` to this
    items:
      - Teaching, supervision and ...
    announced: 2024-03-18                 # optional; see "Announcements"
```

On the printed CV an entry is two lines: **title** with `dates` right-aligned, then `org, detail`
with `place` right-aligned.

`title` is the strong word on the line, so make it the thing worth reading. For a membership or a
subscription there is often no title; write the body in `title` and leave `org` out
— `title: Geoscience Society of New Zealand` reads better than `title: Member`.

`detail` is the same field everywhere and nothing interprets it: it is one more line of prose after
`org`. What it conventionally holds therefore changes with the section — the sub-unit of an
appointment (`Department of Geology`), the role held on a piece of fieldwork (`Co-chief scientist`),
the fluency of a language (`Native`), the explanation of a research strand. Read the section, not the
field name, to know what to write.

A classification or grade is part of the title string: `M.Sc. in Earth Sciences (First Class
Honours)`, `Ph.D. in Mathematics (Excellent cum laude)`.

### Which sections exist

`content/cv.yaml` may hold **any** top-level list you like, and `cv/cv.tex` decides which of them
the PDF prints, in what order, under what heading — one line per section. Add a section to the
YAML and a `\cvpart{Your Heading}{YourKey}` line to `cv.tex` and it is printed.

**The website is not open in the same way.** It renders exactly these keys:

| Key | Where it appears on the site |
| --- | --- |
| `appointments`, `education`, `teaching`, `supervision`, `awards`, `languages`, `leadership` | `/cv/` |
| `service` | `/professional_activities/` and the home page |
| `projects` | `/projects/` |

A section you invent — `fieldwork:`, `outreach:` — reaches the **printed CV** and the **register**
(where it announces as `Fieldwork`), and not a page of its own until a route is added for it. Use
the names above where they fit.

**A section you have none of: leave the key out**, or write `awards: []`. Both are the same: no
heading, no gap, nothing printed, no error.

### Entry fields some sections need

| Field | Means | Printed as |
| --- | --- | --- |
| `metric` | a ranking or impact figure | `**[IF: 6.5, Q1]**` after `org` |
| `rank_url` | where that figure is evidenced | the site links `metric` to it |
| `years` | editions of a recurring role | `2024–2026` after `org` |
| `funding` | grant or programme amount | website only, never the CV |
| `count` | how many | after the detail, or as a column in a section table |
| `rows` | a table hanging under the entry | see below |

`years` and `dates` are not alternative spellings of each other. `dates` is one free-form string for
a single continuous span (`Mar 2024 – Present`), set in the right-hand column. `years` is a list of
the separate editions of a recurring role, printed after `org` and folded to `2024–2026` when they
run consecutively. A role that recurs in some years and not others keeps them visible as a list; use
both fields on one entry only when it genuinely has a span and named editions.

`years` is a plain list. Only an edition that carries an announcement date grows into a map:

```yaml
years: [2024, { year: 2025, announced: 2024-06-10 }, 2026]
```

`rows:` turns an entry into a heading over a table. **Each row's keys, in the order you write
them, are the columns, and the key name becomes the heading.** Write `points:` and the column says
"Points". The build refuses rows whose columns or key order disagree, and generates equal-width
columns for however many keys you use.

```yaml
teaching:
  - title: Lecturer
    org: University of Example
    dates: 2024 – Present
    rows:
      - course: Databases
        programme: B.Sc. Computer Science
        topics: SQL; relational algebra
        hours: 30 h/yr
```

A section-level `note` is not an entry field. A section that needs a paragraph of its own above
its entries is written as a map:

```yaml
supervision:
  note:
    - "**Total supervision:** ... "
    - "**Topic coverage:** ... "
  entries:
    - title: B.Sc. theses
      count: 10+
      detail: End-to-end supervision of ...
```

### Prose you may write in any field

`**bold**`, `_italic_`, `[text](url)`. Write typographic characters as the real character:
`—` `–` `€`. A bare `*` is literal, so `CORE Rank: A*` is safe.

Everything else is escaped for you, including `$`, `&`, `%` and `#` — `NZ$960,000` is safe.
The **one** exception is a URL: no address may contain `\ ~ _ ^ $ { }`, so percent-encode those
(`~` is `%7E`, `_` is `%5F`, `\` is `%5C`). The build refuses rather than emitting a wrong link.
On the website, a root-relative address in inline link markup or a profile/section URL field is
prefixed with the project path from `profile.site`; absolute and non-root-relative addresses are
used as written.

The CV is set in the Unicode TeX Gyre Pagella family. It includes Latin Extended characters such
as the macrons in `Te Apārangi`; search the LaTeX log for `Missing character` if your record uses
another script, because no single bundled font covers every writing system.

## `publications.bib` and `talks.bib`

Standard BibTeX. Export from Zotero, Mendeley, DBLP or Google Scholar and drop the file in.
Nothing is filtered: every entry is shown on the site, including manuscripts under review.
Both `journal` and BibLaTeX's `journaltitle` are read, so a Better BibTeX BibLaTeX export works.

### How they are grouped: `publications:` and `talks:` in `cv.yaml`

**A section is a title plus a filter, and you declare it.** No publication entry type is named in
`cv.tex` or in the website's source, so every BibTeX type is expressible — an adopter whose career
is books, datasets or patents declares a section and it works, with no LaTeX edit. The
`publications:` declaration is read by both, so the PDF and the publication index cannot disagree
about how the work is grouped.

```yaml
publications:
  sections:
    - title: Journal articles (peer-reviewed) # the heading in the PDF
      short: Journal # the site's Type column, the "J=Journal" key, and — through
                     # its first letter — the PDF's numbering prefix (J1, J2, …)
      types: [article] # entry types, ANY of which matches
    - title: Conference papers (peer-reviewed)
      short: Conference
      types: [inproceedings]
      exclude_keywords: [workshop] # keywords, NONE of which may be present
    - title: Workshop papers
      short: Workshop
      types: [inproceedings]
      keywords: [workshop] # keywords, ALL of which must be present
    - title: Books & chapters
      short: Books
      types: [incollection, book]
    - title: Software & artifacts
      short: Software
      types: [misc]
      printed: false # named on the site; no section in the PDF
```

Declaration order is match order and, among printed sections, print order. Each publication lands
in the **first** section it matches, in the PDF exactly as on the site: each printed section's
biblatex filter is compiled as its own criteria *minus* every section declared above it, including
any carrying `printed: false`, so an entry two sections accept is printed once and labelled the
same way. Two more keys: `prefix:` overrides the numbering letter (it defaults to `short`'s first
letter, and two printed sections claiming the same one is an error, not a silent collision), and
`printed: false` omits a section from the PDF; a publication section remains named on the website
— the answer to "on the site, not in the CV", as `leadership:` is for ordinary sections. Every
section is checked, printed or not: one with no criteria at all would match the whole bibliography,
so it is refused rather than accepted quietly.

**Types and keywords are matched exactly as Biber matches them**, because Biber is the other
consumer: entry types are written in **lower case** (biber lower-cases every one before testing a
filter, so `types: [Article]` is refused rather than silently matching nothing), a `keywords`
field is a **comma-separated** list, and a keyword matches only as written. A semicolon-separated
`keywords` field — DBLP writes some — is therefore one long keyword to both consumers.

`short` is a display label and nothing reads it for meaning: rename it, translate it, and the
site and the PDF follow. In particular both halves of the under-review rule — keeping an
unannounced manuscript out of the register, and wording an announced one "submitted to {venue}" —
read the entry's own `underreview` keyword, not the name of the section it lands in.

**A section whose filter matches nothing prints nothing at all** — no heading, no gap — so
declaring one costs nothing until the first entry arrives. An entry matching no section is still
shown on the site, labelled `Other`; that is the visible sign that you have no group for it yet.

`talks:` takes the same shape over `talks.bib` and controls the PDF's talk headings, filters,
numbering prefixes and key. The `/talks/` page deliberately does not relabel talks from this
declaration: its badges and descriptions remain each entry's own `keywords` and `note`, so
`printed: false` on a talk section only omits that section from the PDF.

`talks.bib` entries look like this — the entry type and every field name matters:

```bibtex
@unpublished{talk_agu_2024,
  author     = {Lovelace, Ada},
  title      = {What the engine cannot do},
  note       = {Invited talk},          % also the label in the register, and its filter
  eventtitle = {AGU Fall Meeting},
  venue      = {Washington, D.C., United States},
  date       = {2024-12-11},            % ISO 8601, required
  keywords   = {invited}                % invited | oral | poster
}
```

## `posts/`

Markdown, one file per post, in `content/posts/`. A post's address is `/blog/<path>/`, so
`posts/2024/what-i-learned.md` is published at `/blog/2024/what-i-learned/` — the directories are
part of the URL. Front matter:

```yaml
---
title: What I learned
description: One sentence.
date: 2025-06-11
draft: false
---
```

## `media/`

Images. `profile.portrait` and the optional `profile.favicon` name files here by bare filename;
**inside a post or an item, refer to one as `/media/<file>`** — the directory is published at
that address. The build prefixes the project path from `profile.site` when the site is deployed
below an origin root.

## Announcements

The website's register of announcements, at `/lately/`, is generated. **You never write a news
item.**

A fact announces itself on a date it already carries: a talk's `date`, a post's `date`, an award's
month, a paper's `year`. An **entry of `cv.yaml` announces when it gives a month
(`dates: Nov 2021`) or an explicit `announced:`** — a `dates:` range is not an announcement.

```yaml
announced: 2024-06-10
```

Add it only where the announcement genuinely happened on a date the entry does not otherwise state.
It is optional everywhere. A fact with nothing to date it is not guessed at: it is listed, with the
reason, in the feed's provenance block. A **manuscript under review** is the case that matters: its
`year` is the year it is aimed at, not a year anything happened in, so it does not announce until
you give it an `announced:` — the day you submitted it. It stays on `/publications/` either way.

The sentence each kind of fact is announced in is one table, `TEMPLATES`, at the top of
`web/src/lib/announcements.ts`. It is the first thing to edit if you want different wording.

## Research strands

The home page renders the optional `strands:` list with the ordinary entry shape. `title` is the
strand name, `detail` is its short explanation, and `items` are evidence notes visible when a
reader turns on **Inspect sources** — they are not body text, so a reader who never opens the
inspect view never sees them. `strands:` is website-only: `cv/cv.tex` prints no strands section.
Omit `strands:` and the block disappears.

## Where the misleading fields land

Most fields reach both the website and the PDF. These land somewhere their names do not say:

| Field | Website | Printed CV |
| --- | --- | --- |
| `profile.site` | the origin and base path of every canonical, feed and sitemap URL | never read |
| `profile.website` | not rendered | printed in the header contact line |
| `profile.bio.short` | shown on `/cv/` as "Short bio" | printed as "Short Bio" |
| `profile.bio.long` | the home page, in full, first sentence quoted above the fold | never printed |
| `profile.address` | the footer | never printed |
| `strands` | the home page; `items` only under **Inspect sources** | no section |
| `funding` | shown under the dates on `/projects/` | never printed |
| `rank_url` | links the `metric` badge | never printed |
| a publication section with `printed: false` | still names and labels its entries | no section, and its entries are subtracted from every section declared below it |

A section key the website has no route for — `fieldwork:`, `outreach:` — reaches the printed CV and
the announcement register but no page of its own; see [Which sections exist](#which-sections-exist).

## Prove a clean handoff

Make the replacement in a clean throwaway checkout of the repository, never in the copy you are
preparing to publish and never in a filesystem copy carrying ignored build outputs. Replace
`content/` with the smallest example above, empty `publications.bib` and `talks.bib`, and your own
portrait and favicon, then run `cd web && npm run build`.

Search the rendered documents in `web/dist/` in both directions: your new name and site domain
must appear, while the previous owner's name and domain must not. For example:

```sh
grep -RInF --include='*.html' --include='*.xml' --include='*.json' --include='*.txt' \
  'Alex Newcomer' web/dist
grep -RInF --include='*.html' --include='*.xml' --include='*.json' --include='*.txt' \
  'alex-newcomer.example' web/dist
grep -RInF --include='*.html' --include='*.xml' --include='*.json' --include='*.txt' \
  'Previous Owner' web/dist
grep -RInF --include='*.html' --include='*.xml' --include='*.json' --include='*.txt' \
  'previous-owner.example' web/dist
```

The first two commands must print matches. The last two must print nothing and exit with status 1.
CI runs the same cold-start proof with a synthetic adopter on every push and pull request.

## The two builds

```bash
npm run build:cv-data            # content/cv.yaml -> cv/generated/cv-data.tex
latexmk -xelatex -cd cv/cv.tex   # the PDF. xelatex, not pdflatex
npm run dev                      # the site
```

`web` refuses to build when two records in `content/` contradict each other; it tells you which
two and where. `astro dev` never refuses, so you are not blocked mid-edit.
