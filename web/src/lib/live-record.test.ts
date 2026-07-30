/**
 * The self-check that reads the real `content/`.
 *
 *   cd web && node --experimental-strip-types src/lib/live-record.test.ts
 *
 * Everything here must hold for ANY valid record, because after adoption the
 * record is the adopter's. Nothing below names an entry key, a venue, a count or
 * a section: it asserts that the record parses, that the generated PDF data
 * still describes the record it was generated from, and that the two matchers
 * that group publications agree about it.
 *
 * Assertions that need a particular BibTeX or YAML shape belong in
 * `record.test.ts` against `fixtures/record/`, never here.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { macroName } from '../../../scripts/build-cv-data.mjs';
import { keywordList, readCv, sections } from './cv-schema.ts';
import { bibliography, publicationSections, readSource, talks, SOURCES } from './record.ts';
import { consistency, report } from './consistency.ts';

assert.ok(
  !process.env.LEDGERPRESS_RECORD_ROOT,
  'this file reads content/; unset LEDGERPRESS_RECORD_ROOT',
);

const root = fileURLToPath(new URL('../../../', import.meta.url));

// ------------------------------------------------------------ the record ----

// The schema boundary, run over the record as written. Everything that reaches a
// page crosses it, so a record that survives this cannot reach the renderers as
// a type they will crash on — and one that does not survive it says which field.
const cv = readCv(parse(readSource(SOURCES.cv)), SOURCES.cv);
assert.ok(cv.profile.name, `${SOURCES.cv}: profile.name is what the whole site is titled from`);

// The gate `astro build` refuses on, run here in ~200ms instead. Both rules it
// enforces hold for any record: two hand-typed dates on one fact may not
// contradict, and a declared exception must name a real check and expire.
const gate = consistency();
assert.deepEqual(gate.contradictions, [], report(gate));
assert.deepEqual(gate.exceptionProblems, [], report(gate));

// The readers agree with the files: what is counted on a page is what is in the
// record, for whatever record that is.
const bib = bibliography();
assert.equal(
  bib.entries.length,
  readSource(SOURCES.bibliography).match(/^@/gm)?.length ?? 0,
  'entry count disagrees with `grep -c "^@"`',
);
assert.equal(
  talks().entries.length,
  readSource(SOURCES.talks).match(/^@/gm)?.length ?? 0,
  'talk count disagrees with `grep -c "^@"`',
);

// ------------------------------------------------- the record and the PDF ---
// `cv/generated/cv-data.tex` is generated from this record. The failure guarded
// here is the committed generated file describing a record that has since moved
// on — which the PDF would print and nothing else would notice.

const declared = publicationSections();
const generated = readFileSync(root + 'cv/generated/cv-data.tex', 'utf8');
const generatedPublicationCount = Number(
  /\\newcommand\{\\cvPublicationsCount\}\{(\d+)\}/.exec(generated)?.[1],
);
assert.equal(
  generatedPublicationCount,
  bib.entries.length,
  'the generated PDF count and website bibliography count disagree — run `npm run build:cv-data`',
);

const printedHeadings = [
  ...generated.matchAll(
    /\\printbibliography\[heading=bibsubheading, title=\{(.+?)\}, filter=Publications/g,
  ),
].map((match) => match[1].replace(/\\&/g, '&'));
assert.deepEqual(
  printedHeadings,
  declared.filter((section) => section.printed !== false).map((section) => section.title),
  'the printed CV and the publication declaration disagree about the sections',
);

// Every top-level list is a section in both readers; the generator emits one
// count macro per section, so a section the generated file has never heard of is
// a section the PDF prints nothing for. The macro name comes from the generator
// itself, so `field_work:` is looked for under the name the generator gave it.
for (const [key] of sections(cv)) {
  const macro = `\\cv${macroName(key)}Count`;
  assert.ok(
    generated.includes(macro),
    `${SOURCES.cv}: the ${key} section has no ${macro} — run \`npm run build:cv-data\``,
  );
}

// -----------------------------------------------------------------------------
// The two matchers, proved equal over this record.
//
// One declaration, two engines: biblatex/Biber selects the printed sections and
// `matchesBibSection` labels the site's. Similar-looking code is not evidence
// they agree, so this evaluates the GENERATED `\defbibfilter` expressions —
// the ones biber will actually run — against every entry in the file and
// checks each entry lands in the same section on both sides.
// -----------------------------------------------------------------------------

/**
 * A biblatex filter expression, evaluated the way biber does: `type=` and
 * `keyword=` tests joined by `and` / `or` / `not`, with parentheses. Keyword
 * lists are comma-separated and every comparison is case-sensitive.
 */
function evaluateFilter(expression: string, type: string, keywords: string): boolean {
  const tokens = expression.match(/\(|\)|[^\s()]+/g) ?? [];
  let at = 0;
  const peek = () => tokens[at];
  const eat = (token: string) => (peek() === token ? (at++, true) : false);
  const atom = (): boolean => {
    if (eat('not')) return !atom();
    if (eat('(')) {
      const value = or();
      assert.ok(eat(')'), `unbalanced parentheses in filter: ${expression}`);
      return value;
    }
    const token = tokens[at++];
    const [field, wanted] = token.split('=');
    if (field === 'type') return type === wanted;
    if (field === 'keyword') return keywordList(keywords).includes(wanted);
    throw new Error(`unsupported filter test "${token}" in: ${expression}`);
  };
  const and = (): boolean => {
    let value = atom();
    while (eat('and')) value = atom() && value;
    return value;
  };
  const or = (): boolean => {
    let value = and();
    while (eat('or')) value = and() || value;
    return value;
  };
  const result = or();
  assert.equal(at, tokens.length, `filter not fully consumed: ${expression}`);
  return result;
}

// Filter N belongs to the Nth declared section: the generator numbers them by
// declaration order so an unprinted section cannot shift the ones below it.
const compiled = [
  ...generated.matchAll(/\\defbibfilter\{Publications(\d+)\}\{([\s\S]*?)\}\n/g),
].map((match) => ({
  section: declared[Number(match[1]) - 1],
  expression: match[2],
}));
assert.equal(
  compiled.length,
  declared.filter((section) => section.printed !== false).length,
  'the generated filters and the declared printed sections do not correspond',
);

for (const entry of bib.entries) {
  const type = entry.type.toLowerCase();
  const keywords = entry.fields.keywords ?? '';
  const printed = compiled.filter((filter) => evaluateFilter(filter.expression, type, keywords));
  assert.ok(
    printed.length <= 1,
    `${entry.key}: printed under ${printed.length} sections but labelled once — ` +
      `${printed.map((f) => f.section.title).join(', ')}`,
  );
  const site = declared.find((section) => section.short === entry.kind);
  const inPdf = printed[0]?.section;
  if (site && site.printed !== false) {
    assert.equal(
      inPdf,
      site,
      `${entry.key}: the site files it under "${site.title}" and the PDF does not`,
    );
  } else {
    assert.equal(
      inPdf,
      undefined,
      `${entry.key}: the site prints it nowhere and the PDF prints it under "${inPdf?.title}"`,
    );
  }
}

console.log(
  `ok — ${SOURCES.cv} parses, ${sections(cv).length} sections, ${bib.entries.length} entries and ` +
    `${talks().entries.length} talks agree with the generated CV data`,
);
