/**
 * Self-check for the CV reader and the inline markup renderer.
 *
 *   cd web && node --experimental-strip-types src/lib/cv.test.ts
 *
 * `src/lib/cv.ts` itself cannot be imported here: it reads the YAML through
 * Vite's `?raw`, which only exists inside a Vite/Astro build. So the shape it
 * declares is asserted against `fixtures/record/content/cv.yaml`, and the
 * reader's own two-line body is checked as text. The pure half of the module
 * lives in `cv-schema.ts` and IS imported, because everything that reads the
 * file under plain node shares it.
 *
 * The fixture, not `content/`: a record with one appointment and nothing else is
 * a valid record, so "the supervision section is present with a note above it"
 * is a claim about the fixture. What must be true of the adopter's own record is
 * enforced at the schema boundary in `cv-schema.ts` and asserted in
 * `live-record.test.ts`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { inline } from './inline.ts';
import {
  countPhrase,
  editionYear,
  entriesOf,
  groupByTitle,
  isEditorial,
  kindTally,
  labelledCount,
  noteOf,
  optsOutOfCv,
  printsInCv,
  readCv,
  sections,
  type Entry,
} from './cv-schema.ts';
import { SOURCES } from './record.ts';

const fixture = fileURLToPath(new URL('./fixtures/record/content/cv.yaml', import.meta.url));

// ------------------------------------------------------------- the reader ---

// `readFileSync(new URL(..., import.meta.url))` builds and then fails at
// prerender with ENOENT, because Astro relocates the module into
// dist/.prerender/ and the relative path follows the bundle. This has already
// cost one build cycle; the guard is cheaper than the next one.
const reader = readFileSync(fileURLToPath(new URL('./cv.ts', import.meta.url)), 'utf8');
assert.match(reader, /content\/cv\.yaml\?raw/, 'cv.ts must read the YAML through Vite `?raw`');
assert.doesNotMatch(
  reader,
  /readFileSync\(|new URL\(/,
  'cv.ts must not resolve cv.yaml from import.meta.url — it fails at prerender',
);
assert.equal(SOURCES.cv, 'content/cv.yaml', 'the CV source is registered in SOURCES');

// --------------------------------------------------------------- the data ---

// Through the schema boundary, exactly as every page reads it: the coercions it
// performs are part of the shape asserted below.
const cv = readCv(parse(readFileSync(fixture, 'utf8')), SOURCES.cv);

assert.throws(
  () => readCv({ profile: { name: 'Researcher', site: 2021 } }, SOURCES.cv),
  /content\/cv\.yaml: profile\.site: expected an absolute HTTP\(S\) URL/,
);

const text = (value: unknown, what: string) =>
  assert.ok(
    typeof value === 'string' && value.trim().length > 0,
    `${what}: not a non-empty string`,
  );

// -------------------------------------------------------------- profile -----
// Everything the site's masthead, footer and front page are built from, and the
// four fields the printed CV's header block is built from. A missing one is a
// silently blank line at the top of both.
const { profile } = cv;
text(profile.name, 'profile.name');
text(profile.headline, 'profile.headline');
text(profile.place, 'profile.place');
text(profile.email, 'profile.email');
text(profile.bio?.short, 'profile.bio.short');
text(profile.bio?.long, 'profile.bio.long');
text(profile.focus, 'profile.focus');
text(profile.footer, 'profile.footer');
text(profile.portrait, 'profile.portrait');

// `affiliation` is a LIST because a cross-appointment is a list. The printed
// header sets the primary one and nothing here assumes a single employer.
assert.ok(Array.isArray(profile.affiliation), 'profile.affiliation must be a list');
assert.ok(profile.affiliation!.length > 0, 'profile.affiliation is empty');
for (const entry of profile.affiliation!) text(entry.label, 'profile.affiliation[].label');

// Known services hold compact IDs; arbitrary services hold one labelled URL
// that both the site and PDF consume.
for (const [kind, link] of Object.entries(profile.links ?? {})) {
  if (typeof link === 'string') {
    text(link, `profile.links.${kind}`);
    assert.doesNotMatch(link, /^https?:\/\//, `profile.links.${kind} is a URL, not an ID`);
  } else {
    text(link.label, `profile.links.${kind}.label`);
    assert.match(link.url, /^https:\/\//, `profile.links.${kind}.url is not HTTPS`);
  }
}

// -------------------------------------------------------------- sections ----
// Every top-level list is a section by construction, in both readers. The
// generator names none of them and neither does this: what is asserted is that
// the sections the website has routes for are present and shaped.
const named = sections(cv).map(([key]) => key);
for (const key of [
  'appointments',
  'education',
  'teaching',
  'supervision',
  'awards',
  'service',
  'projects',
  'languages',
  'leadership',
])
  assert.ok(named.includes(key), `the fixture record lost the ${key} section`);

// One entry shape, one required field, everywhere.
for (const [key, section] of sections(cv)) {
  for (const entry of entriesOf(section)) {
    text(entry.title, `${key}[].title`);
  }
}

const appointments = entriesOf(cv.appointments);
const education = entriesOf(cv.education);
const teaching = entriesOf(cv.teaching);
const supervision = entriesOf(cv.supervision);
const awards = entriesOf(cv.awards);
const service = entriesOf(cv.service);
const projects = entriesOf(cv.projects);
const languages = entriesOf(cv.languages);
const leadership = entriesOf(cv.leadership);

for (const entry of [...appointments, ...education]) {
  text(entry.org, 'appointments/education[].org');
  text(entry.dates, 'appointments/education[].dates');
}

// A `rows:` table is the entry's own keys, in the order they are written, and
// that order IS the column order of the same table in the printed CV. Reordering
// two keys reorders two columns, silently, so the key set is asserted here.
const courses = teaching.flatMap((block) => block.rows ?? []);
assert.ok(teaching.length >= 1, 'the fixture lost its teaching entry');
for (const block of teaching) {
  text(block.org, 'teaching[].org');
  text(block.dates, 'teaching[].dates');
  assert.ok((block.rows ?? []).length > 0, `teaching "${block.org}": no rows`);
  for (const row of block.rows ?? [])
    assert.deepEqual(
      Object.keys(row),
      ['course', 'programme', 'topics', 'points'],
      `teaching "${block.org}": row keys are the printed table's columns, in this order`,
    );
}
assert.ok(
  teaching.some((block) => /present\s*$/i.test(block.dates ?? '')),
  'no teaching post dates run to Present',
);

// `printed: false` is the record's own opt-out, and only the section that states
// it opts out: an absent key and an empty list say nothing either way, so /cv/
// cannot describe one of those three states as another.
assert.equal(optsOutOfCv({ printed: false, entries: [] }), true);
assert.equal(optsOutOfCv({ entries: [{ title: 'Co-chair' }] }), false);
assert.equal(optsOutOfCv([]), false);
assert.equal(optsOutOfCv(undefined), false);
// Reaching the PDF also needs entries, which is the rule cv/cv.tex applies.
assert.equal(printsInCv({ printed: false, entries: [{ title: 'Co-chair' }] }), false);
assert.equal(printsInCv([{ title: 'Co-chair' }]), true);
assert.equal(printsInCv([]), false);
assert.equal(printsInCv(undefined), false);

// A section written as a map: a `note` above its `entries`.
assert.equal(noteOf(cv.supervision).length, 1, 'supervision lost its note paragraph');
for (const row of supervision) {
  text(row.detail, 'supervision.entries[].detail');
  // "1" is quoted in the file precisely so it stays a string; "10+" is not a
  // number at all. Either way the page prints it verbatim.
  text(String(row.count), 'supervision.entries[].count');
  assert.deepEqual(
    Object.keys(row),
    ['title', 'count', 'detail'],
    "supervision entry keys are the printed table's columns, in this order",
  );
}

assert.ok(awards.length > 0, 'the fixture lost its award entries');

// `service[]` feeds /professional_activities/, which groups by `title` and hangs
// a linked rank badge off `metric`. A `metric` with no `rank_url` is a badge that
// claims a ranking and cannot show where it is published.
assert.ok(service.length >= 1, `service[] lost entries: ${service.length}`);
for (const entry of service) {
  text(entry.org, 'service[].org');
  if (entry.metric) {
    assert.match(
      entry.rank_url ?? '',
      /^https:\/\//,
      `service[] "${entry.org}" states a metric but no rank_url for the badge to link to`,
    );
  }
  // An entry states a term (`dates`) or the editions it served (`years[]`) or
  // neither — several standing reviewer roles have no date at all, and the page
  // says so rather than inventing one. What it may not do is state both.
  assert.ok(
    !(entry.dates && entry.years?.length),
    `service[] "${entry.org}" states both dates and years[]; the page shows one column`,
  );
  // An edition is a bare year, or a map when it carries an announcement date.
  // The common case does not pay for the rare one.
  for (const edition of entry.years ?? []) {
    const year = editionYear(edition);
    assert.ok(
      Number.isInteger(year) && year > 2000,
      `service[] "${entry.org}": implausible edition year ${year}`,
    );
    if (typeof edition === 'object')
      assert.ok(
        edition.announced,
        `service[] "${entry.org}" ${year}: a map with no announced date`,
      );
  }
}
// The home page and /professional_activities/ both render `service[]` through
// `groupByTitle()`. The grouping is asserted here against the same YAML, so a
// change that makes one page's grouping lose entries fails the build rather than
// making the two pages disagree again.
const groups = groupByTitle(service);
assert.equal(
  groups.reduce((total, group) => total + group.entries.length, 0),
  service.length,
  'grouping service[] by title dropped entries',
);
assert.equal(
  new Set(groups.map((group) => group.role)).size,
  groups.length,
  'duplicate role group',
);
// The home page's headline figure. `/\beditor\b/i` over the title field is the
// whole rule, so it must select the editorships and nothing else.
const editorial = service.filter((entry) => isEditorial(entry.title));
assert.equal(editorial.length, 1, `expected 1 editorial board, got ${editorial.length}`);
assert.ok(
  editorial.every((entry) => entry.title === 'Associate Editor'),
  'the editorial rule selected a role that is not an editorship',
);
assert.deepEqual(countPhrase(0, 'editorial board', 'editorial boards'), {
  count: 0,
  words: 'editorial boards',
  text: '0 editorial boards',
});
assert.equal(countPhrase(1, 'editorial board', 'editorial boards').text, '1 editorial board');
assert.equal(countPhrase(2).text, '2 entries');
assert.equal(
  countPhrase(
    1,
    'entry carries no date and is shown undated',
    'entries carry no date and are shown undated',
  ).text,
  '1 entry carries no date and is shown undated',
);
assert.equal(
  countPhrase(
    2,
    'entry carries no date and is shown undated',
    'entries carry no date and are shown undated',
  ).text,
  '2 entries carry no date and are shown undated',
);
const oneAnnouncement = countPhrase(1, 'announcement', 'announcements');
const twoAnnouncements = countPhrase(2, 'announcement', 'announcements');
assert.equal(
  countPhrase(
    1,
    `of ${oneAnnouncement.text} is shown here`,
    `of ${oneAnnouncement.text} are shown here`,
  ).text,
  '1 of 1 announcement is shown here',
);
assert.equal(
  countPhrase(
    2,
    `of ${twoAnnouncements.text} is shown here`,
    `of ${twoAnnouncements.text} are shown here`,
  ).text,
  '2 of 2 announcements are shown here',
);
assert.equal(countPhrase(1, 'is not', 'are not').text, '1 is not');
assert.equal(countPhrase(2, 'is not', 'are not').text, '2 are not');
assert.equal(`${countPhrase(2).text} · Journal`, '2 entries · Journal');
assert.equal(`${countPhrase(1).text} · Books & chapters`, '1 entry · Books & chapters');

const countSensitivePages = [
  '../pages/index.astro',
  '../pages/professional_activities.astro',
  '../pages/projects/index.astro',
  '../pages/publications/[...sort].astro',
  '../pages/talks.astro',
  '../pages/blog/index.astro',
  '../pages/cv.astro',
];
const hardCodedCountNoun =
  /(?:\$\{[^{}]*(?:\.length|\.size)\}|\{[^{}]*(?:\.length|\.size)\})[^{}]{0,64}\b(?:appointments|awards|boards|courses|degrees|entries|items|labels|languages|posts|presentations|projects|roles|rows|talks|venues)\b/;
// What a reader actually sees on a count row. This used to be asserted by
// matching the page's own markup, which a reformat of that markup broke while
// every rendered word stayed correct; the composition now lives in
// `labelledCount` and is asserted as text.
assert.equal(labelledCount(countPhrase(1), 'Journal').line, 'entry · Journal');
assert.equal(labelledCount(countPhrase(2), 'Journal').line, 'entries · Journal');
assert.equal(
  labelledCount(countPhrase(1), 'Books & chapters').line,
  'entry · Books & chapters',
  'a declared label is reproduced verbatim, never inflected or recased',
);
assert.equal(labelledCount(countPhrase(2)).line, 'entries', 'no label, no separator');
assert.equal(
  labelledCount(countPhrase(1, 'editorial board', 'editorial boards')).line,
  'editorial board',
);
assert.equal(labelledCount(countPhrase(2), 'Journal').label, 'Journal');
assert.equal(labelledCount(countPhrase(2), 'Journal').count, 2);

assert.equal(kindTally({ kind: 'Journal', count: 1 }), 'Journal: 1');
assert.equal(kindTally({ kind: 'Books & chapters', count: 4 }), 'Books & chapters: 4');
assert.equal(kindTally({ count: 1 }), '1 entry', 'an unkinded tally still inflects its own noun');
assert.equal(kindTally({ count: 3 }), '3 entries');

for (const page of ['../pages/index.astro', '../pages/publications/[...sort].astro']) {
  const source = readFileSync(fileURLToPath(new URL(page, import.meta.url)), 'utf8');
  assert.doesNotMatch(
    source,
    /kind\.kind\.toLowerCase|category:/,
    `${page}: recases a declared label`,
  );
}
for (const page of countSensitivePages) {
  const source = readFileSync(fileURLToPath(new URL(page, import.meta.url)), 'utf8');
  assert.match(
    source,
    /\bcountPhrase\(/,
    `${page}: generated count labels do not use countPhrase()`,
  );
  assert.doesNotMatch(source, /\bplural\(/, `${page}: bypasses whole-phrase agreement`);
  assert.doesNotMatch(source, /\blength\s*===\s*1\s*\?/, `${page}: duplicates countPhrase()`);
  assert.doesNotMatch(
    source.replace(/\s+/g, ' '),
    hardCodedCountNoun,
    `${page}: generated count noun bypasses countPhrase()`,
  );
}

// `projects[]` feeds /projects/, including the funding figures the printed CV
// deliberately omits — the reason they are in this file at all.
assert.equal(projects.length, 2, `expected 2 research projects, got ${projects.length}`);
for (const project of projects) {
  text(project.detail, 'projects[].detail');
  text(project.dates, 'projects[].dates');
  text(project.funding, `projects[].funding (${project.title})`);
}

for (const language of languages) text(language.detail, 'languages[].detail');
assert.ok(leadership.length > 0, 'the fixture lost its leadership entries');

// --------------------------------------------------------------- the markup ---

assert.equal(inline('**bold**'), '<b>bold</b>');
assert.equal(inline('_italic_'), '<i>italic</i>');
assert.equal(inline('[text](https://example.org/a)'), '<a href="https://example.org/a">text</a>');
assert.equal(inline('a **b _c_ d** e'), 'a <b>b <i>c</i> d</b> e');
assert.equal(
  inline('**[figure](/media/figure.svg)**', '/scholar/'),
  '<b><a href="/scholar/media/figure.svg">figure</a></b>',
);
assert.equal(inline(undefined), '');

// The two rules the LaTeX generator already settled, and where a regex renderer
// silently goes wrong.
for (const literal of ['a_b', 'snake_case', 'file_name.txt', 'a_b_c_d']) {
  assert.equal(inline(literal), literal, `intra-word underscore was read as emphasis: ${literal}`);
}
assert.equal(inline('CORE Rank: A*'), 'CORE Rank: A*', 'a bare * must pass through');
assert.equal(inline('**[CORE Rank: A*]**'), '<b>[CORE Rank: A*]</b>');

// Nothing in the YAML may become markup of its own.
assert.equal(inline('a & b <i>c</i>'), 'a &amp; b &lt;i&gt;c&lt;/i&gt;');
assert.equal(inline('[x](https://a/"onerror=b)'), '<a href="https://a/&quot;onerror=b">x</a>');

// The real prose: both markers render, and no delimiter survives into the page.
assert.ok(
  inline(profile.bio!.short!).includes('<b>') && inline(profile.bio!.short!).includes('<i>'),
  'profile.bio.short lost its emphasis',
);

// Every string the page prints — the same field set the LaTeX generator routes
// through `renderInline` — goes through `inline()`, so markup added to any of
// them must render rather than print its delimiters. Because there is one entry
// shape, this is now every value of every entry of every section, with no list
// of field names to fall behind the file.
const stringsOf = (entry: Entry): unknown[] => [
  ...Object.values(entry).filter((value) => typeof value === 'string'),
  ...(entry.items ?? []),
  ...(entry.rows ?? []).flatMap((row) => Object.values(row)),
];
const rendered = [
  profile.bio!.short,
  profile.bio!.long,
  profile.focus,
  profile.footer,
  ...sections(cv).flatMap(([, section]) => [
    ...noteOf(section),
    ...entriesOf(section).flatMap(stringsOf),
  ]),
]
  .filter((value): value is string => typeof value === 'string')
  .map(inline);
for (const html of rendered) {
  assert.doesNotMatch(html, /\*\*/, `unrendered ** left in the page: ${html.slice(0, 60)}`);
  assert.doesNotMatch(
    html,
    /(?<![A-Za-z0-9])_|_(?![A-Za-z0-9])/,
    `unrendered _ left in the page: ${html.slice(0, 60)}`,
  );
}

// This line counts things too, so it inflects through the same helper the pages
// use rather than hard-coding plural nouns beside a variable count.
const tally = (rows: unknown[], singular: string, plural: string) =>
  countPhrase(rows.length, singular, plural).text;
console.log(
  `ok — ${tally(sections(cv), 'section', 'sections')}: ` +
    `${tally(appointments, 'appointment', 'appointments')}, ` +
    `${tally(education, 'degree', 'degrees')}, ` +
    `${tally(teaching, 'teaching post', 'teaching posts')} / ` +
    `${tally(courses, 'course', 'courses')}, ` +
    `${tally(supervision, 'supervision row', 'supervision rows')}, ` +
    `${tally(awards, 'award', 'awards')}, ` +
    `${tally(service, 'service role', 'service roles')}, ` +
    `${tally(projects, 'project', 'projects')}, ` +
    `${tally(languages, 'language', 'languages')}, ` +
    `${tally(leadership, 'leadership role', 'leadership roles')}`,
);
