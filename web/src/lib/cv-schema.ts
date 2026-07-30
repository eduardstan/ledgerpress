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
 * Shared by `/professional_activities/` and the home page's service column so
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
