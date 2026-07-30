/**
 * The shape of `content/cv.yaml`, and the pure functions over it.
 *
 * Split out of `cv.ts` because that module reads the file through Vite's `?raw`,
 * which only exists inside an Astro build. `announcements.ts` and
 * `consistency.ts` also run under plain `node` in the self-checks, so they read
 * the file themselves and share these types and helpers rather than declaring
 * their own — the readers cannot disagree about the shape.
 *
 * Nothing here is transcribed: the interfaces below name the fields
 * `content/cv.yaml` already has.
 */

/**
 * A declared exception to one consistency check, on the fact it excuses.
 *
 * Not a suppressions file and not a flag: it lives in the data beside what it
 * silences, it names exactly one check, it states a reason that is rendered to
 * the reader, and it carries an expiry or an explicit permanent scope.
 * `src/lib/consistency.ts` enforces all four rules on the exception itself — an
 * unknown check id or a blank reason fails the build, because a typo must never
 * look like a successful excuse.
 */
export interface Exception {
  /** One check id from `CHECKS` in `src/lib/consistency.ts`. No wildcards. */
  check: string;
  because: string;
  /** ISO day, or the explicit non-expiring marker `permanent`. */
  until: string;
}

/** One edition of a recurring role: a bare year, or a year that was announced. */
export type Edition = number | { year: number; announced?: string };

/** The year an edition states, whichever of the two shapes it is written in. */
export const editionYear = (edition: Edition) =>
  typeof edition === 'number' ? edition : edition.year;

/** The announcement date an edition carries, where it carries one. */
export const editionAnnounced = (edition: Edition) =>
  typeof edition === 'number' ? undefined : edition.announced;

/**
 * One entry, and there is only one entry shape.
 *
 * An appointment, a degree, a teaching post, a service role, a project, an
 * award, a supervision row and a leadership role are all this. The six
 * interfaces that used to say almost the same thing are gone: `title` is what it
 * was, `org` is where, and the section-specific extras below are optional
 * everywhere. Prose fields carry the `inline.ts` grammar.
 */
export interface Entry {
  /** What it was. The only field that is not optional. */
  title: string;
  /** Where it was — institution, journal, conference. */
  org?: string;
  /** The city. */
  place?: string;
  dates?: string;
  /** One short line more. Printed beside `org` on a line that does not wrap. */
  detail?: string;
  /** The site links `org` to this. */
  url?: string;
  items?: string[];
  /**
   * ISO 8601 date the fact was announced, when the entry's own `dates` range
   * does not already carry it at that precision. Optional everywhere.
   */
  announced?: string;
  except?: Exception[];

  // -- section-specific extras, all optional --
  /** "CORE Rank: A*", "IF: 6.5, Q1" — the file's own words for a ranking. */
  metric?: string;
  /** Where `metric` is evidenced: a CORE portal or SCImago page. */
  rank_url?: string;
  /** Editions of a recurring role. */
  years?: Edition[];
  /** Grant or programme amount. Website only — the printed CV never carries it. */
  funding?: string;
  /** How many. A table column, in a section rendered as a table. */
  count?: string | number;
  /** A table hanging under the entry: each row's keys, in order, are the columns. */
  rows?: Record<string, string>[];
}

/**
 * A section is a list of entries, or a list with the fields below above it.
 *
 * `heading` and `printed` are read by `scripts/build-cv-data.mjs` only: the
 * printed CV prints every section of the record, under the heading its key spells
 * out, unless the section says otherwise. The website has its own routes and
 * headings, so neither field changes a page — `printed: false` is the record's way
 * of saying "on the site, not in the CV", as it is for a publication group.
 */
export type Section =
  | Entry[]
  | {
      note?: string | string[];
      /** The heading the printed CV gives it. Defaults to the key, spelt out. */
      heading?: string;
      /** `false` keeps the section out of the printed CV. Website unaffected. */
      printed?: boolean;
      entries: Entry[];
    };

/** The entries of a section, whichever of the two shapes it is written in. */
export const entriesOf = (section: Section | undefined): Entry[] =>
  Array.isArray(section) ? section : (section?.entries ?? []);

/**
 * Whether the section as written opts out of the printed CV: it says
 * `printed: false` itself. A section that is absent, or an empty list, says
 * nothing — those are different record states and neither is this one.
 *
 * `scripts/build-cv-data.mjs` emits this opt-out as `\cv<Key>Printed{0}` and the
 * layout guards every section on it, so the reader and the generator agree.
 */
export const optsOutOfCv = (section: Section | undefined): boolean =>
  !Array.isArray(section) && section?.printed === false;

/**
 * Whether a section reaches the printed CV, by the same rule `cv/cv.tex` applies:
 * it has entries, and it did not opt out.
 */
export const printsInCv = (section: Section | undefined): boolean =>
  entriesOf(section).length > 0 && !optsOutOfCv(section);

/** The paragraphs above a section's entries, as a list. */
export const noteOf = (section: Section | undefined): string[] =>
  Array.isArray(section) || !section?.note ? [] : [section.note].flat();

/**
 * One group of bibliography entries: a title plus a filter. Not a query
 * language.
 *
 * `publications:` and `talks:` in `content/cv.yaml` declare these.
 * `scripts/build-cv-data.mjs` turns both into the biblatex filters and
 * `\printbibliography` calls the PDF needs. The publication index also matches
 * entries against the `publications:` list here; the talks page deliberately
 * keeps each entry's own `keywords` and `note` instead of relabelling it.
 */
export interface BibSection {
  /** The heading the printed CV gives the group. */
  title: string;
  /** Its short name in the CV key; publications also use it in the site's Type column. */
  short: string;
  /** BibTeX entry types, any of which matches. Omitted means any type. */
  types?: string[];
  /** Keywords, all of which must be present. */
  keywords?: string[];
  /** Keywords, none of which may be present. */
  exclude_keywords?: string[];
  /** The entry-numbering letter in the PDF. Defaults to `short`'s first letter. */
  prefix?: string;
  /** `false` omits the PDF section; a publication group remains named on the site. */
  printed?: boolean;
}

/** A top-level key holding sections rather than entries. */
export interface BibSections {
  sections: BibSection[];
}

/**
 * The keywords a BibTeX `keywords` field lists.
 *
 * Biber's semantics and nothing else: the list is comma-separated, and a
 * keyword matches only as written. No lowercasing, and `;` is not a separator —
 * biblatex's `keyword=` test is neither of those things, and this matcher and
 * the generated `\defbibfilter` have to select the same entries or the site and
 * the printed CV disagree about how the same work is grouped. A DBLP entry
 * whose `keywords` are semicolon-delimited is therefore one long keyword to
 * both consumers, which is what Biber already believed.
 */
export const keywordList = (field = ''): string[] =>
  field
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean);

/**
 * Whether one entry belongs to one declared section.
 *
 * Entry types compare as written too. Both consumers see the type in Biber's
 * canonical lower case — the BibTeX reader lowercases it here, biber lowercases
 * it there — so a declaration writes its types in lower case and
 * `scripts/build-cv-data.mjs` refuses one that does not.
 */
export function matchesBibSection(section: BibSection, type: string, keywords = ''): boolean {
  const present = keywordList(keywords);
  if (section.types?.length && !section.types.includes(type)) return false;
  if (!(section.keywords ?? []).every((keyword) => present.includes(keyword))) return false;
  if ((section.exclude_keywords ?? []).some((keyword) => present.includes(keyword))) return false;
  return true;
}

/** The first declared section an entry belongs to — print order is match order. */
export const bibSectionFor = (
  sections: readonly BibSection[],
  type: string,
  keywords = '',
): BibSection | undefined => sections.find((section) => matchesBibSection(section, type, keywords));

export interface Profile {
  name: string;
  site?: string;
  headline?: string;
  affiliation?: { label: string; url?: string }[];
  place?: string;
  /** Street-level postal lines. Website only; the printed CV never carries them. */
  address?: string[];
  email?: string;
  website?: { label: string; url: string };
  links?: Record<string, string | { label: string; url: string }>;
  portrait?: string;
  favicon?: string;
  bio?: { short?: string; long?: string };
  focus?: string;
  footer?: string;
}

/**
 * `content/cv.yaml`.
 *
 * `profile` is the only key this type names, because it is the only one the
 * generator names too. Every other top-level key is a section by construction —
 * an adopter may add `fieldwork:` and the printed CV will render it — so the
 * index signature is the shape, not a gap in the typing. The keys listed below
 * are the ones the website has a route for.
 */
export interface CV extends Record<string, Section | Profile | BibSections | undefined> {
  profile: Profile;
  /** How `content/publications.bib` is grouped. Not a section: it has no entries. */
  publications?: BibSections;
  /** The same, for `content/talks.bib`. */
  talks?: BibSections;
  appointments?: Section;
  education?: Section;
  teaching?: Section;
  supervision?: Section;
  awards?: Section;
  service?: Section;
  projects?: Section;
  languages?: Section;
  leadership?: Section;
  /** Research themes rendered on the home page. */
  strands?: Section;
}

// ------------------------------------------------------------ the boundary --

/**
 * A record this file cannot accept, stated the way an adopter can act on it.
 *
 * Nothing but the message matters: a stack trace into a bundled Astro chunk is
 * not an error message. Every one of these names the file, the field path and
 * what was expected instead.
 */
export class RecordError extends Error {
  override name = 'RecordError';
}

/** What a value is, in the words the record's author would use for it. */
const describe = (value: unknown): string =>
  value === null || value === undefined
    ? 'nothing'
    : Array.isArray(value)
      ? 'a list'
      : value instanceof Date
        ? 'a date'
        : typeof value === 'object'
          ? 'a map'
          : `${typeof value} ${JSON.stringify(value)}`;

const isMap = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);

/**
 * A scalar as text.
 *
 * `dates: 2021` is a year and a year is obviously a date, so YAML making it a
 * number is not the author's mistake to fix — and a YAML parser configured for
 * timestamps turns `announced: 2019-11-20` into a Date, which is the same
 * accident one type further on. Both are coerced here.
 *
 * This is not date normalisation: the spelling an entry uses reaches the page
 * exactly as written, which is what `content/README.md` promises. Only the
 * JavaScript type changes.
 */
function text(value: unknown, where: string): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  throw new RecordError(`${where}: expected text, found ${describe(value)}`);
}

/** The same, for a field that may simply be absent. */
const optionalText = (value: unknown, where: string): string | undefined =>
  value === null || value === undefined ? undefined : text(value, where);

function list(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value))
    throw new RecordError(`${where}: expected a list, found ${describe(value)}`);
  return value;
}

function map(value: unknown, where: string): Record<string, unknown> {
  if (!isMap(value)) throw new RecordError(`${where}: expected a map, found ${describe(value)}`);
  return value;
}

/** Every field one entry may carry — the fields `Entry` above declares. */
const ENTRY_FIELDS = [
  'title',
  'org',
  'place',
  'dates',
  'detail',
  'url',
  'items',
  'announced',
  'except',
  'metric',
  'rank_url',
  'years',
  'funding',
  'count',
  'rows',
] as const;

/** The entry fields the record writes as prose, and the page prints verbatim. */
const ENTRY_TEXT = [
  'org',
  'place',
  'dates',
  'detail',
  'url',
  'announced',
  'metric',
  'rank_url',
  'funding',
  'count',
] as const;

const PROFILE_FIELDS = [
  'name',
  'site',
  'headline',
  'affiliation',
  'place',
  'address',
  'email',
  'website',
  'links',
  'portrait',
  'favicon',
  'bio',
  'focus',
  'footer',
] as const;

/** A field the record names that this file does not. Almost always a typo. */
function known(value: Record<string, unknown>, fields: readonly string[], where: string): void {
  for (const field of Object.keys(value)) {
    if (!fields.includes(field)) {
      throw new RecordError(
        `${where}.${field}: unknown field. The fields here are: ${fields.join(', ')}.`,
      );
    }
  }
}

function readEntry(value: unknown, where: string): void {
  const entry = map(value, where);
  known(entry, ENTRY_FIELDS, where);
  entry.title = text(entry.title, `${where}.title`);
  for (const field of ENTRY_TEXT) {
    const coerced = optionalText(entry[field], `${where}.${field}`);
    if (coerced !== undefined) entry[field] = coerced;
  }
  if (entry.items !== undefined) {
    entry.items = list(entry.items, `${where}.items`).map((item, index) =>
      text(item, `${where}.items[${index}]`),
    );
  }
  if (entry.rows !== undefined) {
    entry.rows = list(entry.rows, `${where}.rows`).map((row, index) => {
      const columns = map(row, `${where}.rows[${index}]`);
      for (const [column, cell] of Object.entries(columns)) {
        columns[column] = text(cell, `${where}.rows[${index}].${column}`);
      }
      return columns;
    });
  }
  if (entry.years !== undefined) {
    entry.years = list(entry.years, `${where}.years`).map((edition, index) => {
      const at = `${where}.years[${index}]`;
      if (typeof edition === 'number') return edition;
      const written = map(edition, at);
      known(written, ['year', 'announced'], at);
      if (typeof written.year !== 'number') {
        throw new RecordError(`${at}.year: expected a year, found ${describe(written.year)}`);
      }
      const announced = optionalText(written.announced, `${at}.announced`);
      if (announced !== undefined) written.announced = announced;
      return written;
    });
  }
  if (entry.except !== undefined) {
    entry.except = list(entry.except, `${where}.except`).map((exception, index) => {
      const at = `${where}.except[${index}]`;
      const declared = map(exception, at);
      known(declared, ['check', 'because', 'until'], at);
      for (const field of ['check', 'because', 'until'] as const) {
        declared[field] = text(declared[field], `${at}.${field}`);
      }
      return declared;
    });
  }
}

function readSection(value: unknown, where: string): void {
  const entries = Array.isArray(value) ? value : map(value, where).entries;
  if (!Array.isArray(value)) {
    const written = value as Record<string, unknown>;
    // `heading` and `printed` are the record's own controls over the printed CV,
    // read by scripts/build-cv-data.mjs. They are section-level, not entry-level.
    known(written, ['note', 'entries', 'heading', 'printed'], where);
    if (written.heading !== undefined) {
      written.heading = text(written.heading, `${where}.heading`);
    }
    if (written.printed !== undefined && typeof written.printed !== 'boolean') {
      throw new RecordError(
        `${where}.printed: expected true or false, found ${describe(written.printed)}`,
      );
    }
    if (written.note !== undefined) {
      written.note = Array.isArray(written.note)
        ? written.note.map((line, index) => text(line, `${where}.note[${index}]`))
        : text(written.note, `${where}.note`);
    }
  }
  list(entries, `${where}.entries`).forEach((entry, index) =>
    readEntry(entry, `${where}[${index}]`),
  );
}

function readBibSections(value: unknown, where: string): void {
  const declared = map(value, where);
  known(declared, ['sections'], where);
  list(declared.sections, `${where}.sections`).forEach((section, index) => {
    const at = `${where}.sections[${index}]`;
    const group = map(section, at);
    known(
      group,
      ['title', 'short', 'types', 'keywords', 'exclude_keywords', 'prefix', 'printed'],
      at,
    );
    group.title = text(group.title, `${at}.title`);
    group.short = text(group.short, `${at}.short`);
    for (const field of ['types', 'keywords', 'exclude_keywords'] as const) {
      if (group[field] !== undefined) {
        group[field] = list(group[field], `${at}.${field}`).map((keyword, position) =>
          text(keyword, `${at}.${field}[${position}]`),
        );
      }
    }
    const prefix = optionalText(group.prefix, `${at}.prefix`);
    if (prefix !== undefined) group.prefix = prefix;
    if (group.printed !== undefined && typeof group.printed !== 'boolean') {
      throw new RecordError(
        `${at}.printed: expected true or false, found ${describe(group.printed)}`,
      );
    }
  });
}

function readProfile(value: unknown, where: string): void {
  const profile = map(value, where);
  known(profile, PROFILE_FIELDS, where);
  profile.name = text(profile.name, `${where}.name`);
  for (const field of [
    'site',
    'headline',
    'place',
    'email',
    'portrait',
    'favicon',
    'focus',
    'footer',
  ] as const) {
    const coerced = optionalText(profile[field], `${where}.${field}`);
    if (coerced !== undefined) profile[field] = coerced;
  }
  if (profile.site) {
    let published: URL;
    try {
      published = new URL(profile.site as string);
    } catch {
      throw new RecordError(
        `${where}.site: expected an absolute HTTP(S) URL without a query or fragment, found ${JSON.stringify(profile.site)}`,
      );
    }
    if (
      !['http:', 'https:'].includes(published.protocol) ||
      published.search.length > 0 ||
      published.hash.length > 0
    ) {
      throw new RecordError(
        `${where}.site: expected an absolute HTTP(S) URL without a query or fragment, found ${JSON.stringify(profile.site)}`,
      );
    }
  }
  if (profile.address !== undefined) {
    profile.address = list(profile.address, `${where}.address`).map((line, index) =>
      text(line, `${where}.address[${index}]`),
    );
  }
  if (profile.affiliation !== undefined) {
    profile.affiliation = list(profile.affiliation, `${where}.affiliation`).map((entry, index) => {
      const at = `${where}.affiliation[${index}]`;
      const written = map(entry, at);
      known(written, ['label', 'url'], at);
      written.label = text(written.label, `${at}.label`);
      const url = optionalText(written.url, `${at}.url`);
      if (url !== undefined) written.url = url;
      return written;
    });
  }
  if (profile.website !== undefined) {
    const site = map(profile.website, `${where}.website`);
    known(site, ['label', 'url'], `${where}.website`);
    site.label = text(site.label, `${where}.website.label`);
    site.url = text(site.url, `${where}.website.url`);
  }
  if (profile.links !== undefined) {
    const links = map(profile.links, `${where}.links`);
    for (const [service, link] of Object.entries(links)) {
      const at = `${where}.links.${service}`;
      if (isMap(link)) {
        known(link, ['label', 'url'], at);
        link.label = text(link.label, `${at}.label`);
        link.url = text(link.url, `${at}.url`);
      } else {
        links[service] = text(link, at);
      }
    }
  }
  if (profile.bio !== undefined) {
    const bio = map(profile.bio, `${where}.bio`);
    known(bio, ['short', 'long'], `${where}.bio`);
    for (const field of ['short', 'long'] as const) {
      const coerced = optionalText(bio[field], `${where}.bio.${field}`);
      if (coerced !== undefined) bio[field] = coerced;
    }
  }
}

/**
 * The parsed `content/cv.yaml`, checked and coerced once, at the one boundary
 * every reader crosses.
 *
 * Five website readers use this file — `astro.config.mjs`, `cv.ts` through
 * Vite, and `record.ts`, `announcements.ts` and `consistency.ts` under plain
 * node — and all five call this, so a record that reaches any page has already
 * been through it. The record is normalised in place and returned; nothing is
 * reordered, renamed or reworded.
 */
export function readCv(parsed: unknown, path = 'content/cv.yaml'): CV {
  if (!isMap(parsed)) {
    throw new RecordError(
      `${path}: expected a map of \`profile:\` and sections, found ${describe(parsed)}. ` +
        'See content/README.md for the smallest file that builds.',
    );
  }
  readProfile(parsed.profile, `${path}: profile`);
  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'profile') continue;
    const where = `${path}: ${key}`;
    if (Array.isArray(value) || Array.isArray((value as { entries?: unknown } | null)?.entries)) {
      readSection(value, where);
    } else if (Array.isArray((value as { sections?: unknown } | null)?.sections)) {
      readBibSections(value, where);
    } else {
      throw new RecordError(
        `${where}: expected a list of entries, a map with \`entries:\`, or a bibliography ` +
          `grouping with \`sections:\` — found ${describe(value)}.`,
      );
    }
  }
  return parsed as CV;
}

/** Every top-level section, in file order. `profile:` is not one. */
export const sections = (source: CV): [string, Section][] =>
  Object.entries(source).filter(
    ([key, value]) =>
      key !== 'profile' &&
      (Array.isArray(value) || Array.isArray((value as { entries?: unknown })?.entries)),
  ) as [string, Section][];

/**
 * The field names a set of rows actually carries, so a source record names real
 * keys rather than the ones this file happens to declare.
 */
export const keysOf = (rows: object[]) =>
  [...new Set(rows.flatMap((row) => Object.keys(row)))].join(', ');

/**
 * An identifier key as a heading label: every word capitalised, separators untouched.
 *
 * Used for announcement kind chips on `/lately/`. Course-table column headers,
 * by contrast, are printed verbatim as written in the record.
 * Section-key casing must match `headingCase` in `scripts/build-cv-data.mjs`.
 */
export const headingCase = (key: string) =>
  key.replace(/[\p{L}\p{N}]+/gu, (word) => word[0].toUpperCase() + word.slice(1));

export interface CountPhrase {
  count: number;
  words: string;
  text: string;
}

export function countPhrase(count: number): CountPhrase;
export function countPhrase(count: number, singular: string, plural: string): CountPhrase;
export function countPhrase(count: number, singular = 'entry', plural = 'entries'): CountPhrase {
  const words = count === 1 ? singular : plural;
  return { count, words, text: `${count} ${words}` };
}

export interface LabelledCount extends CountPhrase {
  /** The declared label, or nothing when the phrase already names what it counts. */
  label?: string;
  /** The whole label line, the count itself excluded: inflected words, then the label. */
  line: string;
}

/**
 * A count phrase carrying the declared section label it belongs to.
 *
 * A declared label is arbitrary and translatable, so it is reproduced verbatim
 * and never inflected; only the phrase's own noun follows the count. The whole
 * line is composed here rather than in page markup, so `cv.test.ts` asserts the
 * text a reader sees instead of the shape of the markup that emits it.
 */
export const labelledCount = (phrase: CountPhrase, label?: string): LabelledCount => ({
  ...phrase,
  label,
  line: label ? `${phrase.words} · ${label}` : phrase.words,
});

/**
 * One kind's tally in a provenance record: its declared label against its
 * count, or the inflected phrase when the bibliography declares no kind.
 */
export const kindTally = (kind: { kind?: string; count: number }) =>
  kind.kind ? `${kind.kind}: ${kind.count}` : countPhrase(kind.count).text;

/**
 * Whether a role is an editorship, matched on the file's own word for it.
 *
 * The home page's "editorial boards" figure is this predicate applied to
 * `service[]`, not a number written anywhere. It is a text rule over the `title`
 * field rather than a list of venues, so a new editorship counts itself.
 */
export const isEditorial = (role: string) => /\beditor\b/i.test(role);

/** The dates column an entry states: a term, or the editions it served. */
export const serviceWhen = (entry: Entry) =>
  entry.dates ?? (entry.years ?? []).map(editionYear).join(', ');

export interface ServiceGroup {
  role: string;
  entries: Entry[];
}

/**
 * Service entries grouped by their own `title` field, roles in the order they
 * first appear in the file.
 *
 * Shared by `/service/` and the home page's service column so
 * the two cannot group the same list differently — the whole reason this reader
 * exists is that those two pages used to take these facts from two files.
 */
export function groupByTitle(entries: Entry[]): ServiceGroup[] {
  const groups: ServiceGroup[] = [];
  for (const entry of entries) {
    const group = groups.find((candidate) => candidate.role === entry.title);
    if (group) group.entries.push(entry);
    else groups.push({ role: entry.title, entries: [entry] });
  }
  return groups;
}
