/**
 * Self-check for the record readers. Everything the Ledger design displays as a
 * count or a source line comes from these functions, so the cheapest guard that
 * catches a broken parse lives here.
 *
 *   cd web && node --experimental-strip-types src/lib/record.test.ts
 *
 * It asserts against `fixtures/record/`, not against `content/`. The shapes
 * below — a parenthesis-delimited `@dataset`, a citation with nothing but a
 * venue, a `Last, First` name, a manuscript under review — are what the readers
 * have to survive, and an adopter who replaces `content/` must not be able to
 * take any of them away. `LEDGERPRESS_RECORD_ROOT` points the readers at that
 * fixture; `live-record.test.ts` holds what must be true of the real record.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  about,
  bibliography,
  profile,
  parseBib,
  publicationKind,
  publicationSections,
  readSource,
  stripMarkdown,
  talks,
  SOURCES,
} from './record.ts';
import { announcements, formatStamp, say, shortVenue, TEMPLATES } from './announcements.ts';
import { bibEntryCount } from '../../../scripts/build-cv-data.mjs';

// Reading `content/` here would make every assertion below a claim about whose
// facts are in it, which is exactly what this file no longer does.
assert.ok(
  process.env.LEDGERPRESS_RECORD_ROOT,
  "run this with LEDGERPRESS_RECORD_ROOT=src/lib/fixtures/record — see that directory's README",
);

const bib = bibliography();
const owner = profile();

// The count the page shows must be the count in the file.
const grepped = readSource(SOURCES.bibliography).match(/^@/gm)!.length;
assert.equal(bib.entries.length, grepped, 'entry count disagrees with `grep -c "^@"`');

// Fields the index columns depend on. Nothing is filtered: every entry in the
// file is shown, including manuscripts under review and released software, so
// each one has to survive the parse intact.
for (const entry of bib.entries) {
  assert.ok(entry.title, `${entry.key}: no title`);
  assert.ok(entry.year > 1990, `${entry.key}: implausible year ${entry.year}`);
  assert.ok(entry.authors.length > 0, `${entry.key}: no authors`);
  assert.ok(entry.venue, `${entry.key}: no venue`);
  assert.ok(!/[{}\\]/.test(entry.title), `${entry.key}: unresolved LaTeX in title`);
  assert.ok(
    !entry.authors.some((a) => /[{}\\]/.test(a)),
    `${entry.key}: unresolved LaTeX in authors`,
  );
  assert.ok(entry.raw.startsWith('@') && /[})]$/.test(entry.raw), `${entry.key}: raw not captured`);
}

const dataset = bib.entries.find((entry) => entry.key === 'kowhai2025cores');
assert.ok(dataset, 'the fixture @dataset entry was not parsed');
assert.equal(dataset.kind, 'Data');
assert.equal(dataset.venue, 'Aotearoa Polar Data Commons');

// One declaration, two consumers. `publications:` in content/cv.yaml says how
// the bibliography is grouped; this file labels the Type column from it and
// `scripts/build-cv-data.mjs` translates the same list into the filters and
// headings the PDF prints. The failure this guards is the two drifting apart —
// which is the whole reason the grouping left cv/cv.tex.
const declared = publicationSections();
assert.ok(declared.length, `${SOURCES.cv}: no publication sections declared`);

// The agnostic promise, asserted rather than assumed: an entry type nobody
// declared a section for is still labelled and still shown. An adopter whose
// career is patents adds `@patent` to the bibliography and SEES it on the site
// under "Other" — which is the visible sign that the interface has no group for
// it yet, not a build that refuses to render the entry.
assert.equal(publicationKind('patent', {}), 'Other', 'an undeclared entry type lost its label');
for (const entry of bib.entries) {
  const label = declared.find((section) => section.short === entry.kind);
  assert.ok(
    label || entry.kind === 'Other',
    `${entry.key}: "${entry.kind}" is neither declared in ${SOURCES.cv} nor the "Other" fallback`,
  );
}

// A property of the fixture as it stands, not an invariant of the reader: every
// fixture entry is claimed by a declared section, so a group quietly dropped
// from the fixture's declaration still fails loudly here.
const unlabelled = bib.entries.filter((entry) => entry.kind === 'Other');
assert.deepEqual(
  unlabelled.map((entry) => `${entry.key} (@${entry.type})`),
  [],
  `${SOURCES.cv}: these entries match no declared publication section`,
);

const parenthesized = String.raw`
@article(parenthesized,
  author = {Lovelace, Ada},
  title = {A valid entry (with nested parentheses)},
  journaltitle = {Journal of Durable Imports},
  year = {1843}
)
`;
const parsedParenthesized = parseBib(parenthesized);
assert.equal(parsedParenthesized.length, 1, 'the website parser dropped a parenthesized entry');
assert.equal(parsedParenthesized[0].fields.title, 'A valid entry (with nested parentheses)');
assert.equal(
  parsedParenthesized.length,
  bibEntryCount(parenthesized),
  'website and generated PDF counts disagree for parenthesized BibTeX',
);
assert.ok(
  bib.entries.find((entry) => entry.key === 'kowhai2025cores')?.raw.endsWith(')'),
  'the real cross-publication proof is no longer parenthesis-delimited',
);
// The citation assembled for the collapsed row. The cases that matter are the
// sparse ones: everything below volume, pages and publisher is optional in this
// file, so the assembler is only ever one missing field away from printing a
// separator with nothing on either side of it.
for (const entry of bib.entries) {
  const where = `${entry.key} (@${entry.type}): "${entry.citation}"`;
  assert.ok(entry.citation, `${where}: no citation assembled`);
  assert.ok(!/,\s*,|\.\s*\.|,\s*\.|;\s*[;.]/.test(entry.citation), `${where}: doubled separator`);
  assert.ok(!/^[,.;\s]|[,;]\s*$/.test(entry.citation), `${where}: leading or trailing separator`);
  assert.ok(!/\(\s*\)|\[\s*\]/.test(entry.citation), `${where}: empty parenthesis`);
  assert.ok(!/\s{2,}/.test(entry.citation), `${where}: doubled space`);
  assert.ok(!/[{}\\]/.test(entry.citation), `${where}: unresolved LaTeX`);
  assert.ok(entry.citation.startsWith(entry.venue), `${where}: does not open with the venue`);
  // The record under the citation names the fields it was built from, so every
  // one of them has to be a field this entry really has.
  for (const field of entry.citationFields) {
    assert.ok(entry.fields[field], `${where}: cites a field it does not have (${field})`);
  }
  // A field that is present and belongs in a citation must reach it.
  for (const field of ['volume', 'number', 'pages'] as const) {
    if (entry.fields[field]) {
      assert.ok(entry.citationFields.includes(field), `${where}: dropped ${field}`);
    }
  }
}

// Journal volume, number and pages appear once and in their expected order.
const article = bib.entries.find((entry) => entry.key === 'kowhai2024chronology')!;
assert.equal(article.citation, 'Climate of the Past 20(8), 1701–1724.');

// Sparse: no volume, no number, no pages, no publisher — a venue and nothing
// else. It must come out as that venue, not as that venue plus punctuation.
const sparse = bib.entries.find((entry) => entry.key === 'kowhai2027seaice')!;
assert.equal(sparse.citation, `${sparse.venue}.`);
assert.deepEqual(sparse.citationFields, ['journaltitle']);
assert.equal(sparse.link, undefined, 'a link was invented for an entry with no address field');

// Links. The DOI leads because it outlives the publisher's URL scheme, and an
// entry with none of the four fields shows no link rather than a dead one.
for (const entry of bib.entries) {
  const where = `${entry.key}: ${entry.link?.href}`;
  if (entry.doi) assert.equal(entry.link?.field, 'doi', `${where}: DOI not preferred`);
  if (!entry.link) {
    assert.ok(
      !entry.doi && !entry.fields.url && !entry.fields.html && !entry.fields.pdf,
      `${entry.key}: has an address field but no link`,
    );
    continue;
  }
  assert.ok(
    /^(https?:\/\/|\/assets\/)/.test(entry.link.href),
    `${where}: not a followable address`,
  );
  // `paper\_29.pdf` is a real filename in this file; a backslash left in the
  // href is a 404, so URLs are unescaped without `deLatex`'s prose rules.
  assert.ok(!/[\\{}]/.test(entry.link.href), `${where}: unresolved LaTeX in a link`);
  assert.ok(!/[–—]/.test(entry.link.href), `${where}: a hyphen pair was typeset as a dash`);
}
// The loop above states the invariant per entry — an entry either links or has
// none of the four address fields — but is vacuously true if nothing resolves.
assert.ok(
  bib.entries.some((entry) => entry.link),
  'no entry resolved a link at all',
);

// Abstracts follow the entries that carry the field; there is no separate
// allow-list that can drift away from the bibliography.
for (const entry of bib.entries) {
  assert.equal(
    Boolean(entry.abstract),
    Boolean(entry.fields.abstract),
    `${entry.key}: abstract presence disagrees with its fields`,
  );
}

// Unicode and the `Last, First` BibTeX name form survive parsing.
const authors = bib.entries.flatMap((entry) => entry.authors);
assert.ok(authors.includes(owner.bibliographyName), 'profile name not normalised like an author');
assert.ok(authors.includes('M. Te Rangi'), 'multi-word surname was initialised away');
const commaFormOwner = bib.entries.find((entry) => entry.key === 'kowhai2024chronology');
assert.equal(
  commaFormOwner?.authors[0],
  owner.bibliographyName,
  '`Last, First` owner name was read as `First Last`',
);

// The generated feed. Every publication and talk is announceable, so the feed
// is at least as long as the bibliography; nothing may reach the page undated,
// unlabelled, or still carrying markdown markers.
const feed = announcements();
assert.ok(feed.items.length >= bib.entries.length, 'the feed is shorter than the bibliography');
for (const item of feed.items) {
  assert.ok(item.text.length > 10, `implausible announcement text: ${item.text}`);
  assert.ok(item.kind, `${item.stamp}: no kind`);
  // A literal `*` is real data — the bibliography contains `OVERLAY@AI*IA 2019`
  // — so what must not survive is an unrendered emphasis pair or a leftover
  // escape from the templates that splice those facts in.
  assert.ok(!item.html.includes('**'), `unrendered bold: ${item.html}`);
  assert.ok(!item.text.includes('**'), `unrendered bold: ${item.text}`);
  assert.ok(!item.text.includes('\\'), `leftover markdown escape: ${item.text}`);
  assert.ok(!Number.isNaN(item.at.valueOf()), `${item.stamp}: unparseable date`);
  // The rendered date may never state more than the source does.
  assert.equal(
    item.precision === 'year',
    /^\d{4}$/.test(formatStamp(item)),
    `${item.stamp}: rendered as "${formatStamp(item)}" at ${item.precision} precision`,
  );
}

// The announcement templates, and the sparse cases they have to survive. Every
// field but the title is optional in the CV, so a template is only ever one
// missing slot away from a dangling comma or an empty parenthesis.
assert.equal(say('Appointment', { what: 'Reader', where: 'Example' }), '**Reader**, Example.');
assert.equal(say('Appointment', { what: 'Reader' }), '**Reader**.');
assert.equal(
  say('Editorial', {
    what: 'Associate Editor',
    where: 'Example Journal',
    detail: 'Marine records',
  }),
  '**Associate Editor**, Example Journal, Marine records.',
);
assert.equal(
  say('Editorial', { what: 'Associate Editor', where: 'Example Journal' }),
  '**Associate Editor**, Example Journal.',
);
assert.equal(
  say('Service', { what: 'Program Committee', where: 'IJCAI', year: '2026' }),
  '**Program Committee**, IJCAI 2026.',
);
assert.equal(
  say('Service', { what: 'Program Committee', where: 'IJCAI' }),
  '**Program Committee**, IJCAI.',
);
assert.equal(
  say('Service', { what: 'Program Committee', year: '2026' }),
  '**Program Committee**, 2026.',
);
assert.equal(say('Service', { what: 'Program Committee' }), '**Program Committee**.');
assert.equal(
  say('Award', { what: 'Best Graduate', detail: 'University of Udine' }),
  '**Best Graduate**, University of Udine.',
);
assert.equal(say('Talk', { what: 'Modal Symbolic Learning' }), '_Modal Symbolic Learning_.');
assert.equal(
  say('Submitted', { what: 'A paper', where: 'JAIR' }),
  '**A paper**, submitted to JAIR.',
);
assert.equal(say('Submitted', { what: 'A paper' }), '**A paper**.');
assert.equal(say('Writing', { what: 'A post' }), '**A post**.');
// An unknown kind — a section an adopter invents — falls back, it does not throw.
assert.equal(
  say('Fieldwork', { what: 'Ross Sea', where: 'RV Tangaroa' }),
  '**Ross Sea**, RV Tangaroa.',
);
// Abbreviated venues already end in a full stop; never two.
assert.equal(
  say('Journal', { what: 'A paper', where: 'Inf. Comput.' }),
  '**A paper**, Inf. Comput.',
);

// The short venue is the acronym the CV puts in brackets — and a bracket holding
// several words is a lab or a group, not an acronym.
assert.equal(
  shortVenue('International Joint Conference on Artificial Intelligence (IJCAI)'),
  'IJCAI',
);
assert.equal(shortVenue('Elsevier Neurocomputing Journal'), 'Elsevier Neurocomputing Journal');
assert.equal(
  shortVenue('University of Example (Marine Research Group)'),
  'University of Example (Marine Research Group)',
);

// No announcement may reach the page with a separator on one side of nothing.
for (const item of feed.items) {
  assert.ok(!/,\s*,|,\s*\.|\(\s*\)|\s{2,}/.test(item.text), `stray separator: ${item.text}`);
  assert.ok(!/^[,.\s]/.test(item.text), `leading separator: ${item.text}`);
  assert.match(item.text, /\.$/, `no full stop: ${item.text}`);
}

// A manuscript under review does not announce on the year it is aimed at, and
// says so in the provenance rather than vanishing.
// Read off the entries' own records, so renaming the section that displays them
// cannot quietly turn this check — or the rule it guards — into a no-op.
const underReview = bib.entries.filter((entry) => entry.underReview);
assert.ok(underReview.length > 0, 'no under-review entries to check the rule against');
for (const entry of underReview) {
  if (entry.fields.announced) continue;
  assert.ok(
    !feed.items.some((item) => item.text.startsWith(entry.title)),
    `${entry.key}: an undated manuscript under review reached the feed`,
  );
  assert.ok(
    feed.undated.some((fact) => fact.what === entry.title),
    `${entry.key}: not in the feed and not named in the undated list either`,
  );
}

// The wording is chosen from what the record structurally is, never from the
// label the declaration displays it under. `TEMPLATES` is keyed on the first,
// so a key that collides with a declared `short` would hand that group another
// group's sentence the moment an adopter renamed one — the same fragile-string
// class the under-review rule above was moved off.
for (const section of declared) {
  assert.ok(
    !(section.short in TEMPLATES),
    `${SOURCES.cv}: section "${section.short}" shares its name with an announcement template`,
  );
}

const linkedPublication = bib.entries.find((entry) => entry.link)!;
const linkedAnnouncement = feed.items.find(
  (item) => item.source === `${SOURCES.bibliography} (${linkedPublication.key})`,
)!;
assert.ok(
  linkedAnnouncement.html.includes(`href="${linkedPublication.link!.href}"`),
  `${linkedPublication.key}: resolved publication link did not reach its announcement`,
);

// Newest first.
for (let i = 1; i < feed.items.length; i++) {
  assert.ok(feed.items[i - 1].at >= feed.items[i].at, 'the feed is not newest-first');
}

// Sorting follows the instant, but display follows the calendar date written in
// the source stamp even when its offset puts that instant on the previous UTC day.
const offsetStamp = '2025-01-01T00:30:00+02:00';
const offsetAnnouncement = {
  ...feed.items[0],
  stamp: offsetStamp,
  at: new Date(offsetStamp),
  precision: 'minute' as const,
};
assert.equal(offsetAnnouncement.at.toISOString().slice(0, 10), '2024-12-31');
assert.equal(formatStamp(offsetAnnouncement), '1 Jan 2025');

// Every talk in content/talks.bib carries its own ISO date, so all of them
// announce. Each one's kind on the feed's apparatus line is its own `note`
// ("Invited talk", "Oral presentation", "Poster presentation") — the word moved
// off the sentence and onto that line, and nothing is relabelled.
const TALK_KINDS = ['Invited keynote', 'Oral presentation'];
const talkItems = feed.items.filter((item) => TALK_KINDS.includes(item.kind));
assert.equal(talkItems.length, 3, `expected 3 talks in the feed, got ${talkItems.length}`);

// ------------------------------------------------------------------ talks ---
// /talks/ renders every entry in content/talks.bib, so the same rule as the
// bibliography applies: nothing filtered, nothing relabelled, nothing left
// carrying LaTeX.
const pres = talks();
const presGrepped = readSource(SOURCES.talks).match(/^@/gm)!.length;
assert.equal(pres.entries.length, presGrepped, 'talk count disagrees with `grep -c "^@"`');
assert.equal(pres.entries.length, 3, `expected 3 talks, got ${pres.entries.length}`);
assert.deepEqual(pres.undated, [], 'a talk reached the page without an ISO 8601 date');

for (const talk of pres.entries) {
  assert.ok(talk.title, `${talk.key}: no title`);
  assert.ok(talk.event, `${talk.key}: no eventtitle`);
  assert.ok(
    talk.note,
    `${talk.key}: no note — the page prints the entry's own word for what it was`,
  );
  // The badge on every row. An entry with no `keywords` would render an empty one.
  assert.ok(talk.category.length > 0, `${talk.key}: empty category`);
  assert.match(
    talk.date,
    /^\d{4}-\d{2}-\d{2}$/,
    `${talk.key}: date "${talk.date}" is not an ISO day`,
  );
  assert.ok(talk.year > 1990, `${talk.key}: implausible year ${talk.year}`);
  for (const [field, value] of Object.entries({
    title: talk.title,
    event: talk.event,
    where: talk.where,
    note: talk.note,
  })) {
    assert.ok(!/[{}\\]/.test(value), `${talk.key}: unresolved LaTeX in ${field} — ${value}`);
  }
}

// A non-ASCII place survives the BibTeX reader.
assert.ok(
  pres.entries.some((talk) => talk.where.includes('Te Whanganui-a-Tara')),
  'the non-ASCII venue was not preserved',
);

// Newest first, and the category counts account for every entry.
for (let i = 1; i < pres.entries.length; i++) {
  assert.ok(pres.entries[i - 1].date >= pres.entries[i].date, 'talks are not newest-first');
}
assert.equal(
  pres.byCategory.reduce((total, category) => total + category.count, 0),
  pres.entries.length,
  'the category counts do not add up to the number of talks',
);
assert.equal(pres.years.first, 2024, `earliest talk year is ${pres.years.first}`);

// About, now `profile.bio.long` in the CV. Prettier runs over the source and
// spells emphasis `_like this_`, so both markers have to render — and neither
// may fire on an underscore inside a word.
const bio = about();
assert.ok(bio.paragraphs.length >= 2, 'profile.bio.long did not parse into paragraphs');
assert.ok(
  !bio.paragraphs.some((paragraph) => /[*_]{1,2}\w/.test(paragraph)),
  'unrendered markdown emphasis left in the about paragraphs',
);
assert.ok(
  bio.paragraphs.some((paragraph) => paragraph.includes('<i>')),
  'no emphasis rendered from the about page',
);
assert.ok(!/[*_]/.test(bio.firstPerson), 'markdown markers left in the first-person line');
// The quote is the opening sentence verbatim. One full stop, not two — a
// one-sentence `bio.long` already ends with the one it has.
assert.ok(!/\.\.$/.test(bio.firstPerson), `doubled full stop: ${bio.firstPerson}`);
assert.match(bio.firstPerson, /[.!?]$/, `the quote does not end a sentence: ${bio.firstPerson}`);
// It is the opening of the first paragraph, not a sentence from elsewhere.
// `paragraphs[0]` is inline HTML, so the comparison is on the plain prefix.
assert.ok(
  stripMarkdown(bio.paragraphs[0].replace(/<[^>]+>/g, '')).startsWith(bio.firstPerson.slice(0, 12)),
  `the quote is not the opening of the first paragraph: ${bio.firstPerson}`,
);
// Every source the site reads lives in `content/`. That is the whole adopter
// interface: a reader pointed anywhere else is a fact the adopter cannot change
// by editing this directory, and the cold-start test stops being true.
for (const [key, path] of Object.entries(SOURCES)) {
  assert.ok(path.startsWith('content/'), `SOURCES.${key} reads outside content/: ${path}`);
}
const reader = readFileSync(fileURLToPath(new URL('./record.ts', import.meta.url)), 'utf8');
assert.doesNotMatch(
  reader,
  /_pages\/|_config\.yml|_bibliography\//,
  'record.ts reads one of the pre-migration files again',
);
// The header brand is derived too: an adopter must not find someone else's
// institution in the bar on every page.
const header = readFileSync(
  fileURLToPath(new URL('../components/Header.astro', import.meta.url)),
  'utf8',
);
assert.doesNotMatch(
  header,
  /University of Otago/,
  'the header brand names the example institution instead of deriving profile.affiliation',
);
// `journaltitle` is BibLaTeX's name for `journal` and is what Zotero's Better
// BibTeX writes. Without it an adopter's most recent article renders with no
// venue and no error anywhere.
assert.match(reader, /'journaltitle'/, 'VENUE_FIELDS lost journaltitle');

console.log(
  `ok — ${bib.entries.length} entries, ${pres.entries.length} talks, ` +
    `${feed.items.length} announcements, ${feed.undated.length} undated facts`,
);
