// Rendering rules for content/cv.yaml facts.
// Run: node --test scripts/build-cv-data.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import {
  affiliationBlock,
  bibEntryCount,
  bibFilter,
  bibPrefix,
  bibSections,
  render,
  editions,
  entry,
  macroName,
  profilesLine,
  renderInline,
  sectionHeading,
  tableHeader,
  where,
} from "./build-cv-data.mjs";

test("an underscore inside a word stays literal and does not open a span", () => {
  // The probe that exposed the bug: a_b used to pair with the opener of
  // _italic_ and italicise everything between them.
  assert.equal(renderInline("a_b and _italic_"), "a\\_b and \\emph{italic}");
  assert.equal(renderInline("see file_name.txt in snake_case"), "see file\\_name.txt in snake\\_case");
});

test("bold, links and a bare asterisk are unchanged", () => {
  assert.equal(renderInline("**bold**"), "\\textbf{bold}");
  assert.equal(renderInline("CORE Rank: A*"), "CORE Rank: A*");
  assert.equal(renderInline("[text](https://example.org/a-b?x=1&y=2)"), "\\href{https://example.org/a-b?x=1\\&y=2}{text}");
});

test("a URL carrying a character TeX consumes raises instead of mislinking", () => {
  assert.throws(() => renderInline("[text](https://example.org/~user)"), /unsafe character "~"/);
  assert.throws(() => renderInline("[text](https://example.org/a_b)"), /unsafe character "_"/);
});

test("an unclosed emphasis marker raises instead of emitting wrong emphasis", () => {
  assert.throws(() => renderInline("_oops"), /unbalanced inline markup/);
  assert.throws(() => renderInline("**oops"), /unbalanced inline markup/);
});

// -----------------------------------------------------------------------------
// One entry shape. `where()` builds the second line of EVERY section, so the
// cases below are one section each: an appointment states only `org`, a project
// only `detail`, a service role both plus its editions and its ranking.
// -----------------------------------------------------------------------------

test("one rule builds the second line of every section", () => {
  assert.equal(where({ title: "Associate Professor", org: "University of Example" }), "University of Example");
  assert.equal(where({ title: "Open Core Chronologies", detail: "Co-investigator" }), "Co-investigator");
  assert.equal(
    where({
      title: "Associate Editor",
      org: "Journal of Example Studies",
      detail: "Marine records",
      metric: "IF: 4.7, Q2",
    }),
    "Journal of Example Studies, Marine records **[IF: 4.7, Q2]**"
  );
  assert.equal(
    where({
      title: "Area Chair",
      org: "IEEE International Joint Conference on Neural Networks (IJCNN)",
      metric: "CORE Rank: B",
      years: [{ year: 2025, announced: "2025-01-11" }, 2026],
    }),
    "IEEE International Joint Conference on Neural Networks (IJCNN), 2025–2026 **[CORE Rank: B]**"
  );
});

test("a sparse entry does not print stray separators", () => {
  // Everything but `title` is optional, so the line is only ever one missing
  // field away from a comma with nothing on one side of it.
  assert.equal(where({ title: "Member" }), "");
  assert.equal(
    where({ title: "Reviewer", org: "PeerJ Computer Science Journal", metric: "IF: 2.5; Q1" }),
    "PeerJ Computer Science Journal **[IF: 2.5; Q1]**"
  );
  assert.equal(where({ title: "Co-Chair", org: "ICIR", years: [2026] }), "ICIR, 2026");
});

test("editions fold when consecutive and are listed when not", () => {
  assert.equal(editions([2024, 2025, 2026]), "2024–2026");
  assert.equal(editions([{ year: 2025, announced: "2024-08-28" }, { year: 2026 }]), "2025–2026");
  assert.equal(editions([2024, 2026]), "2024, 2026");
  assert.equal(editions([2026, 2025]), "2026, 2025");
  assert.equal(editions([2026]), "2026");
  assert.equal(editions(undefined), "");
});

// -----------------------------------------------------------------------------
// The header block
// -----------------------------------------------------------------------------

test("the address block collapses to one line for one affiliation", () => {
  assert.equal(
    affiliationBlock({
      headline: "Postdoctoral Researcher",
      affiliation: [{ label: "University of Somewhere" }],
      place: "Somewhere, Elsewhere",
    }),
    "Postdoctoral Researcher, University of Somewhere, Somewhere, Elsewhere"
  );
});

test("the address block sets several affiliations over several lines", () => {
  // `affiliation` is a list because a cross-appointment is a list; nothing here
  // assumes one employer.
  assert.equal(
    affiliationBlock({
      headline: "Assistant Professor (RTD/a)",
      affiliation: [{ label: "Research Group" }, { label: "Faculty of Science" }, { label: "University of Example" }],
      place: "Example City, Aotearoa New Zealand",
    }),
    "Assistant Professor (RTD/a), Research Group \\\\\nFaculty of Science, \\\\\nUniversity of Example, Example City, Aotearoa New Zealand"
  );
  // No affiliation at all is still a valid line rather than a stray comma.
  assert.equal(affiliationBlock({ headline: "Researcher", place: "Anywhere" }), "Researcher, Anywhere");
});

test("profile.links accepts compact IDs and arbitrary labelled URLs", () => {
  assert.equal(profilesLine({ orcid: "0000-0002-1825-0097" }), "\\cviconorcid\\,\\href{https://orcid.org/0000-0002-1825-0097}{0000-0002-1825-0097}");
  // A blank ID is dropped rather than rendered as an empty link.
  assert.equal(profilesLine({ orcid: "", github: undefined }), "");
  assert.throws(() => profilesLine({ bluesky: "ada.example.com" }), /not a known account kind/);
  assert.equal(
    profilesLine({ bluesky: { label: "Bluesky", url: "https://bsky.app/profile/ada.example" } }),
    "\\cviconlink\\,\\href{https://bsky.app/profile/ada.example}{Bluesky}"
  );
});

// -----------------------------------------------------------------------------
// Sections, which the generator knows nothing about
// -----------------------------------------------------------------------------

test("a section key becomes a legal macro name", () => {
  assert.equal(macroName("appointments"), "Appointments");
  assert.equal(macroName("field_work"), "FieldWork");
  assert.equal(macroName("teaching"), "Teaching");
});

test("a table's header is its own row keys, so renaming a key renames a column", () => {
  // The friction log's F12: an NZ adopter writes `points:` and the column says
  // "Points" without a LaTeX edit.
  assert.equal(tableHeader([{ course: "Databases", points: "18 points" }]), "\\textbf{Course} & \\textbf{Points} \\\\");
});

test("a table refuses rows whose columns or key order disagree", () => {
  assert.throws(
    () =>
      entry({
        title: "Lecturer",
        rows: [
          { course: "Databases", points: "18" },
          { points: "20", course: "Algorithms" },
        ],
      }),
    /same columns in the same order/
  );
});

test("an empty or absent rows list emits no course table", () => {
  const withoutRows = entry({ title: "Lecturer" });
  const withEmptyRows = entry({ title: "Lecturer", rows: [] });
  assert.equal(withEmptyRows, withoutRows);
  assert.doesNotMatch(withEmptyRows, /\\cvcourses/);
});

// -----------------------------------------------------------------------------
// Which sections print, and in what order. Both are record facts: the generator
// emits the sequence and cv/cv.tex prints it. A section added to content/cv.yaml
// must reach the PDF with no .tex edit at all - the defect this replaced was a
// content operation that required one.
// -----------------------------------------------------------------------------

/** The `\cvautopart` lines of the generated section sequence, in order. */
function sequence(tex) {
  const macro = tex.match(/\\newcommand\{\\cvAutoSections\}\{%\n([\s\S]*?)%\n\}/);
  assert.ok(macro, "the generator must emit \\cvAutoSections for cv.tex to print");
  return macro[1] ? macro[1].split("%\n") : [];
}

test("a section invented in the record joins the printed sequence, in file order", () => {
  const tex = render(
    load(`
profile:
  name: Alex Newcomer
appointments:
  - title: Postdoctoral Researcher
outreach:
  - title: Sediment cores for schools
`)
  );
  assert.deepEqual(sequence(tex), ["\\cvautopart{Appointments}{Appointments}", "\\cvautopart{Outreach}{Outreach}"]);
});

test("a record with no sections still emits the sequence, so cv.tex always has one to print", () => {
  assert.deepEqual(sequence(render({ profile: { name: "Alex Newcomer" } })), []);
});

test("printed: false is an opt-out every section setting honours", () => {
  const tex = render(
    load(`
profile:
  name: Alex Newcomer
leadership:
  printed: false
  entries:
    - title: Co-chair, working group
`)
  );
  // The opt-out is one macro, not a hole in the sequence: cv.tex guards every
  // section on it, so it holds for the ones that file lays out by hand as well.
  assert.match(tex, /\\newcommand\{\\cvLeadershipPrinted\}\{0\}/);
  assert.deepEqual(sequence(tex), ["\\cvautopart{Leadership}{Leadership}"]);
  // And the section is still generated, for the website and for the counts.
  assert.match(tex, /\\newcommand\{\\cvLeadership\}/);
  assert.match(tex, /\\newcommand\{\\cvLeadershipCount\}\{1\}/);
});

test("a section the record does not opt out of defines no Printed macro, so 1 is the default", () => {
  const tex = render(load("profile:\n  name: Alex Newcomer\nawards:\n  - title: Prize\n"));
  assert.doesNotMatch(tex, /cvAwardsPrinted/);
});

test("a section prints under its key spelt out unless the record names its heading", () => {
  assert.equal(sectionHeading("fieldwork", []), "Fieldwork");
  assert.equal(sectionHeading("open_science", { entries: [] }), "Open Science");
  assert.equal(sectionHeading("awards", { heading: "Awards & Scholarships", entries: [] }), "Awards \\& Scholarships");
});

test("cv.tex prints the record's section sequence and names no section inside it", () => {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const strip = (text) => text.replace(/(^|[^\\])((?:\\\\)*)%.*$/gm, "$1$2");
  const read = (name) => strip(readFileSync(join(root, "cv", name), "utf8"));
  // The macros live in the shared preamble since the split; the body that must
  // print the sequence is cv/cv.tex, and cv/supervision.tex is a body fragment it
  // inputs, so the definitions and the usages are read from different files now.
  const tex = [read("preamble.tex"), read("supervision.tex"), read("cv.tex")].join("\n");
  const cv = read("cv.tex");

  assert.match(cv, /^\\cvAutoSections$/m, "the document body must print the generated section sequence");

  // The skip below is order-dependent: \cvautopart passes over a key only once
  // \cvdeclare has marked it laid out, so every hand-placed section must appear
  // above \cvAutoSections or it prints twice, once under each heading. An
  // \input of a fragment that declares a key counts as laying it out.
  const body = cv.slice(cv.indexOf("\\begin{document}"));
  const lastLaidOut = Math.max(
    body.lastIndexOf("\\cvdeclare{"),
    body.lastIndexOf("\\cvpart{"),
    body.lastIndexOf("\\cvpart["),
    body.lastIndexOf("\\cvpartflush{"),
    body.lastIndexOf("\\cvpartflush["),
    body.lastIndexOf("\\input{supervision.tex}")
  );
  assert.ok(
    body.search(/^\\cvAutoSections$/m) > lastLaidOut,
    "\\cvAutoSections must come after every \\cvpart, \\cvpartflush, \\cvdeclare and declaring " +
      "\\input in the body, or the section below it prints twice"
  );

  // \cvautopart is what makes the sequence safe to print in full: a key this
  // layout already set by hand is skipped rather than printed twice.
  const autopart = tex.match(/\\newcommand\{\\cvautopart\}\[2\]\{([\s\S]*?)\n\}/);
  assert.ok(autopart, "\\cvautopart must remain defined");
  assert.match(autopart[1], /\\csname cvlaidout@#2\\endcsname\\relax\\cvpart\{#1\}\{#2\}/);
  // `printed: false` is a record fact, so every section setting honours it: the
  // \cvpart family and each hand-written block guard on \cv<Key>Printed, which
  // \cvdeclare defaults to 1 - and records the key as laid out by hand while it is
  // there. A block that guards only on the count would print a section the record
  // asked to keep off the PDF.
  const cvdeclare = tex.match(/\\newcommand\{\\cvdeclare\}\[1\]\{([\s\S]*?)\n\}/)[1];
  assert.match(cvdeclare, /\\cvlaidout\{#1\}/);
  assert.match(cvdeclare, /\\providecommand\\csname cv#1Printed\\endcsname\{1\}/);
  // Bibliographies are excluded: `publications:` and `talks:` opt out per declared
  // group, and their count guard exists for biber's empty-data-source trap.
  const bibliographies = [...tex.matchAll(/\\cvdeclarebib\{([A-Za-z]+)\}/g)].map((m) => m[1]);
  const guarded = [...tex.matchAll(/\\ifnum\\(?:csname )?cv([A-Za-z]+?|#3)(?:Count\\endcsname|Count)>0/g)]
    .map((m) => m[1])
    .filter((key) => !bibliographies.includes(key));
  for (const key of guarded) {
    const printed = key === "#3" ? String.raw`\\ifnum\\csname cv#3Printed\\endcsname>0` : String.raw`\\ifnum\\cv${key}Printed>0`;
    assert.match(tex, new RegExp(printed), `the ${key} section must also guard on its Printed macro`);
  }
});

// A variant is a curated subset, so it deliberately does NOT print the record's
// section sequence - printing every section the layout did not name is the one
// thing it exists not to do. It still honours `printed: false`, because it
// reaches every section through \cvpart, which guards on \cv<Key>Printed.
// Without this the two mechanisms silently cancel: a variant that grew a
// \cvAutoSections line would print the whole record under a "short CV" title.
for (const document of ["short.tex", "teaching.tex"]) {
  test(`cv/${document} curates its own sections rather than printing the record's sequence`, () => {
    const root = dirname(dirname(fileURLToPath(import.meta.url)));
    const tex = readFileSync(join(root, "cv", document), "utf8").replace(/(^|[^\\])((?:\\\\)*)%.*$/gm, "$1$2");
    assert.doesNotMatch(tex, /\\cvAutoSections/, `${document} is a curated subset and must not print every remaining section`);
    assert.match(tex, /\\cvpart(?:flush)?[[{]/, `${document} must place its sections with \\cvpart, which honours printed: false`);
  });
}

// -----------------------------------------------------------------------------
// Bibliography sections. A section is a title plus a filter: which BibTeX entry
// type belongs under which heading is declared in content/cv.yaml, never here
// and never in cv/cv.tex.
// -----------------------------------------------------------------------------

test("a section's filter is any of types, all of keywords, none of the excluded", () => {
  assert.equal(bibFilter({ types: ["article"] }, "x"), "type=article");
  assert.equal(bibFilter({ types: ["incollection", "book"] }, "x"), "( type=incollection or type=book )");
  assert.equal(bibFilter({ types: ["inproceedings"], exclude_keywords: ["workshop"] }, "x"), "type=inproceedings and not keyword=workshop");
  assert.equal(bibFilter({ keywords: ["invited"] }, "x"), "keyword=invited");
});

test("every BibTeX entry type is expressible, including the ones nobody wrote a filter for", () => {
  // The point of the redesign: an adopter whose career is datasets or patents
  // declares a section and it works, with no LaTeX edit.
  assert.equal(bibFilter({ types: ["dataset", "patent"] }, "x"), "( type=dataset or type=patent )");
  assert.equal(bibFilter({ types: ["misc"] }, "x"), "type=misc");
});

test("a section with no filter raises rather than printing the whole bibliography", () => {
  assert.throws(() => bibFilter({ title: "Everything" }, "publications.sections[0]"), /at least one of/);
});

test("a filter token that is not a bare word raises before it reaches biblatex", () => {
  assert.throws(() => bibFilter({ types: ["in proceedings"] }, "x"), /not a usable BibTeX entry type/);
});

test("an entry type written in upper case raises instead of matching nothing anywhere", () => {
  // biber lowercases every entry type before testing a filter, and so does the
  // website's reader, so `type=Article` would select nothing on either side.
  assert.throws(() => bibFilter({ types: ["Article"] }, "x"), /must be written in lower case/);
});

test("the numbering letter defaults to the short name's first letter", () => {
  assert.equal(bibPrefix({ short: "Journal" }), "J");
  assert.equal(bibPrefix({ short: "Under review" }), "U");
  assert.equal(bibPrefix({ short: "Chapters", prefix: "B" }), "B");
});

test("declared sections become the key line and the printed sections, in file order", () => {
  const [filters, key, body] = bibSections("publications", {
    sections: [
      { title: "Journal articles", short: "Journal", types: ["article"] },
      { title: "Books & chapters", short: "Books", types: ["incollection"] },
    ],
  });
  assert.equal(
    filters,
    "\\defbibfilter{Publications1}{type=article}\n" + "\\defbibfilter{Publications2}{type=incollection and not ( type=article )}"
  );
  assert.match(key, /J=Journal, B=Books/);
  assert.match(body, /labelprefix=J[\s\S]*title=\{Journal articles\}, filter=Publications1/);
  // The heading is escaped on the way into LaTeX like every other prose field.
  assert.match(body, /title=\{Books \\& chapters\}, filter=Publications2/);
});

test("a section marked `printed: false` is named for the website and never printed", () => {
  const [filters, key, body] = bibSections("publications", {
    sections: [
      { title: "Journal articles", short: "Journal", types: ["article"] },
      { title: "Software & artifacts", short: "Software", types: ["misc"], printed: false },
    ],
  });
  assert.doesNotMatch(filters, /\\defbibfilter\{Publications2\}/);
  assert.doesNotMatch(key, /Software/);
  assert.doesNotMatch(body, /Software/);
});

test("a printed section's filter excludes every predicate declared before it", () => {
  // biblatex tests each filter on its own, so two filters that both accept an
  // entry both print it - while the website labels it with the FIRST section it
  // matches. Subtracting the earlier predicates is what makes the two agree.
  const [filters] = bibSections("publications", {
    sections: [
      { title: "Journal articles", short: "Journal", types: ["article"] },
      { title: "Conference papers", short: "Conference", types: ["inproceedings"], exclude_keywords: ["workshop"] },
      { title: "Workshop papers", short: "Workshop", types: ["inproceedings"], keywords: ["workshop"] },
    ],
  });
  assert.match(filters, /\{Publications1\}\{type=article\}/);
  assert.match(filters, /\{Publications2\}\{type=inproceedings and not keyword=workshop and not \( type=article \)\}/);
  assert.match(
    filters,
    /\{Publications3\}\{type=inproceedings and keyword=workshop and not \( type=article \) and not \( type=inproceedings and not keyword=workshop \)\}/
  );
});

test("an unprinted section still claims its entries, so the printed ones below it exclude it", () => {
  // `printed: false` names a group for the website. An entry the website files
  // there must not be printed again by a section declared after it.
  const [filters] = bibSections("publications", {
    sections: [
      { title: "Software & artifacts", short: "Software", types: ["misc"], printed: false },
      { title: "Everything else", short: "Other work", exclude_keywords: ["hidden"] },
    ],
  });
  assert.match(filters, /\{Publications2\}\{not keyword=hidden and not \( type=misc \)\}/);
});

test("an unprinted section is validated too, rather than relabelling the website in silence", () => {
  // A criteria-less section matches every entry. Placed first, it would take
  // the whole bibliography's Type column with it on the site while the PDF,
  // which never prints it, looked untouched.
  assert.throws(
    () =>
      bibSections("publications", {
        sections: [
          { title: "Everything", short: "Everything", printed: false },
          { title: "Journal articles", short: "Journal", types: ["article"] },
        ],
      }),
    /at least one of/
  );
  assert.throws(
    () =>
      bibSections("publications", {
        sections: [{ title: "Nameless", types: ["misc"], printed: false }],
      }),
    /needs both a title and a short name/
  );
});

test("two sections claiming the same numbering letter raise instead of colliding", () => {
  assert.throws(
    () =>
      bibSections("publications", {
        sections: [
          { title: "Conference papers", short: "Conference", types: ["inproceedings"] },
          { title: "Chapters", short: "Chapters", types: ["incollection"] },
        ],
      }),
    /already used by "Conference"/
  );
});

test("a directive-only BibTeX file has no entries", () => {
  assert.equal(bibEntryCount("@comment{Nothing to print}"), 0);

  const bib = `
@comment{
@article{disabled, title = {Example}}
}
@PREAMBLE{"Nothing to print"}
@String{venue = "Nothing to print"}
`;
  assert.equal(bibEntryCount(bib), 0);
  assert.equal(bibEntryCount("@comment{\n@article{disabled, title = {Example}}"), 1);
  assert.equal(bibEntryCount(`${bib}\n@article{paper, title = {Printable}}`), 1);

  const quoted = String.raw`
@string(foo = "Proceedings (")
@string(bar = "Proceedings \"(\"")
@article{paper, title = {Printable}}
`;
  assert.equal(bibEntryCount(quoted), 1);
});

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/** A layout file with its TeX comments removed, so a commented-out macro name does not count. */
const layout = (name) => readFileSync(join(root, "cv", name), "utf8").replace(/(^|[^\\])((?:\\\\)*)%.*$/gm, "$1$2");

// The macro contract between the generator and the layout, asserted where it is
// defined. Every document under cv/ inputs this file, so a variant inherits the
// contract rather than restating it.
test("cv/preamble.tex keeps the declaration macros the generated file relies on", () => {
  const tex = layout("preamble.tex");

  const cvdeclare = tex.match(/\\newcommand\{\\cvdeclare\}\[1\]\{([\s\S]*?)\n\}/);
  assert.ok(cvdeclare, "\\cvdeclare must remain defined");
  for (const suffix of ["Count", "", "Note", "Rows", "Inline"]) {
    assert.match(cvdeclare[1], new RegExp(String.raw`\\providecommand\\csname cv#1${suffix}\\endcsname`));
  }

  const cvdeclarebib = tex.match(/\\newcommand\{\\cvdeclarebib\}\[1\]\{([\s\S]*?)\n\}/);
  assert.ok(cvdeclarebib, "\\cvdeclarebib must remain defined");
  for (const suffix of ["Count", "Key", "Sections"]) {
    assert.match(cvdeclarebib[1], new RegExp(String.raw`\\providecommand\\csname cv#1${suffix}\\endcsname`));
  }

  // The optional argument is the entry count, and it must reach \cvmax: the
  // generator guards every entry with \ifnum<n>>\cvmax, so a layout that stops
  // setting it would print whole sections where a variant asked for three.
  const cvpart = tex.match(/\\newcommand\{\\cvpart\}\[3\]\[\\cvall\]\{([\s\S]*?)\n\}/);
  assert.ok(cvpart, "\\cvpart must remain defined, taking an optional entry count");
  assert.match(cvpart[1], /\\renewcommand\{\\cvmax\}\{#1\}/);
  // \cvdeclare must come BEFORE the group: its \providecommand declarations are
  // local, so scoping them would undo the cold-start protection they exist for.
  assert.match(cvpart[1], /^\s*\\cvdeclare\{#3\}\s*\{/);
  // \cvpart[0] must omit the section, not open an itemize the generated guard
  // then leaves empty - "Something's wrong--perhaps a missing \item".
  assert.match(cvpart[1], /\\ifnum#1>0/);

  const cvpartflush = tex.match(/\\newcommand\{\\cvpartflush\}\[3\]\[\\cvall\]\{([\s\S]*?)\n\}/);
  assert.ok(cvpartflush, "\\cvpartflush must remain defined");
  assert.match(cvpartflush[1], /^\s*\\cvdeclare\{#3\}\s*\{/);
  assert.match(cvpartflush[1], /\\cvpart\[#1\]\{#2\}\{#3\}/);

  // One named sentinel, so \cvmax and the two optional-argument defaults cannot
  // drift apart; and \cvmax must have a default, or the guard around the first
  // entry of the first section is undefined in every document.
  assert.match(tex, /\\newcommand\{\\cvall\}\{\d+\}/);
  assert.match(tex, /\\newcommand\{\\cvmax\}\{\\cvall\}/);
});

// The cold-start trap: a document names a macro the generator only emits when
// cv.yaml declares the section it comes from, so an adopter's first
// `latexmk -xelatex -cd cv/cv.tex` stops at TeX's interactive `?` prompt with
// an undefined control sequence. This checks the whole class at once, against
// the very file content/README.md tells a newcomer to start from.
//
// The bundled variants are checked too. They are the documentation for how a
// variant is written, so one that only builds against the example record would
// teach the trap rather than avoid it.
for (const document of ["cv.tex", "short.tex", "teaching.tex"]) {
  test(`cv/${document} defines every generated macro it names, for README's smallest file that works`, () => {
    const readme = readFileSync(join(root, "content/README.md"), "utf8");
    const minimal = readme.match(/## The smallest file that works\s*```yaml\n([\s\S]*?)```/);
    assert.ok(minimal, "content/README.md no longer carries a `The smallest file that works` example");
    // Every document inputs the shared fragments, so their macros are in scope.
    const shared = ["preamble.tex", "header.tex", "supervision.tex"].map(layout);
    const tex = [...shared, layout(document)].join("\n");

    const defined = new Set();
    const add = (names) => names.forEach((name) => defined.add(name));
    for (const [, name] of render(load(minimal[1])).matchAll(/\\newcommand\{\\(cv[A-Za-z]+)\}/g)) defined.add(name);
    for (const [, name] of tex.matchAll(/\\(?:new|provide)command\{\\(cv[A-Za-z]+)\}/g)) defined.add(name);
    // The layout's own guards, which build their macro names with \csname.
    const section = (name) => ["Count", "Printed", "", "Note", "Rows", "Inline"].map((suffix) => `cv${name}${suffix}`);
    for (const [, name] of tex.matchAll(/\\cvdeclare\{([A-Za-z]+)\}/g)) add(section(name));
    for (const [, name] of tex.matchAll(/\\cvpart(?:flush)?(?:\[\d+\])?\{[^{}]*\}\{([A-Za-z]+)\}/g)) add(section(name));
    for (const [, name] of tex.matchAll(/\\cvdeclarebib\{([A-Za-z]+)\}/g)) add([`cv${name}Count`, `cv${name}Key`, `cv${name}Sections`]);

    const referenced = [...tex.matchAll(/\\(cv[A-Z][A-Za-z]*)/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(referenced.filter((name) => !defined.has(name)))], []);
  });
}
