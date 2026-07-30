// Unit tests for ORCID importer (scripts/import-orcid.mjs)
// Run: node --test scripts/import-orcid.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { parseOrcidRecord, formatOrcidYaml, extractOrcidId } from "./import-orcid.mjs";

const require = createRequire(import.meta.url);
const jsYaml = require(require.resolve("js-yaml", { paths: ["."] }));

const __dirname = dirname(fileURLToPath(import.meta.url));

test("extractOrcidId handles raw iD, full URL, or leading path", () => {
  assert.equal(extractOrcidId("0000-0002-1825-0097"), "0000-0002-1825-0097");
  assert.equal(extractOrcidId("https://orcid.org/0000-0002-1825-0097"), "0000-0002-1825-0097");
  assert.equal(extractOrcidId("orcid.org/0000-0002-1825-0097/"), "0000-0002-1825-0097");
  assert.equal(extractOrcidId("invalid-id"), null);
});

test("imports recorded ORCID fixture covering complete entry, no end date, missing department, and missing title", () => {
  const fixturePath = join(__dirname, "fixtures", "orcid-fixture.json");
  const rawData = JSON.parse(readFileSync(fixturePath, "utf-8"));

  const parsed = parseOrcidRecord(rawData);
  const yamlOutput = formatOrcidYaml(parsed);

  // Output must parse as valid YAML
  const loaded = jsYaml.load(yamlOutput);
  assert.ok(loaded);
  assert.ok(Array.isArray(loaded.appointments));
  assert.ok(Array.isArray(loaded.education));

  // 1. Complete entry (Senior Researcher: no end date, has department, place, url)
  const completeEntry = loaded.appointments.find((a) => a.title === "Senior Researcher");
  assert.ok(completeEntry);
  assert.equal(completeEntry.org, "University of Science");
  assert.equal(completeEntry.place, "Oxford, Oxfordshire, United Kingdom");
  assert.equal(completeEntry.dates, "Jan 2022 – Present");
  assert.equal(completeEntry.detail, "Department of Computer Science");
  assert.equal(completeEntry.url, "https://example.org/senior-researcher");

  // 2. Entry with no end date (dates carries " – Present")
  assert.equal(completeEntry.dates.includes("Present"), true);

  // 3. Entry missing its department (Postdoctoral Fellow: department-name is null)
  const noDeptEntry = loaded.appointments.find((a) => a.title === "Postdoctoral Fellow");
  assert.ok(noDeptEntry);
  assert.equal(noDeptEntry.org, "Research Institute");
  assert.equal(noDeptEntry.place, "Cambridge, United States");
  assert.equal(noDeptEntry.dates, "Jun 2019 – Dec 2021");
  assert.equal(noDeptEntry.detail, undefined); // omitted

  // 4. Missing role-title entry (generates comment in YAML output)
  assert.match(yamlOutput, /# title: missing in ORCID record - complete by hand/);

  // 5. Education entry
  const eduEntry = loaded.education[0];
  assert.equal(eduEntry.title, "Ph.D. in Computer Science");
  assert.equal(eduEntry.org, "University of Informatics");
  assert.equal(eduEntry.place, "Edinburgh, United Kingdom");
  assert.equal(eduEntry.dates, "2014 – 2018");
  assert.equal(eduEntry.detail, "School of Informatics");

  // 6. Ordering: newest first (Senior Researcher 2022-Present comes before Postdoctoral Fellow 2019-2021)
  const titles = loaded.appointments.map((a) => a.title).filter(Boolean);
  assert.deepEqual(titles, ["Senior Researcher", "Postdoctoral Fellow"]);
});

test("imports ORCID record fixture with no employments at all", () => {
  const fixturePath = join(__dirname, "fixtures", "orcid-no-employments.json");
  const rawData = JSON.parse(readFileSync(fixturePath, "utf-8"));

  const parsed = parseOrcidRecord(rawData);
  const yamlOutput = formatOrcidYaml(parsed);

  const loaded = jsYaml.load(yamlOutput);
  assert.ok(loaded);
  assert.deepEqual(loaded.appointments, []);
  assert.equal(loaded.education.length, 1);
  assert.equal(loaded.education[0].title, "B.Sc. in Physics");
});

test("selects the highest display-index assertion from each affiliation group", () => {
  const summary = (title, displayIndex) => ({
    "display-index": displayIndex,
    "role-title": title,
    "start-date": { year: { value: "2020" } },
    "end-date": { year: { value: "2021" } },
    organization: { name: "Example University" },
  });
  const group = (key, lowerTitle, preferredTitle) => ({
    summaries: [{ [key]: summary(lowerTitle, 1) }, { [key]: summary(preferredTitle, 10) }],
  });
  const parsed = parseOrcidRecord({
    "activities-summary": {
      employments: {
        "affiliation-group": [group("employment-summary", "Old employment", "Preferred employment")],
      },
      educations: {
        "affiliation-group": [group("education-summary", "Old education", "Preferred education")],
      },
      qualifications: {
        "affiliation-group": [group("qualification-summary", "Old qualification", "Preferred qualification")],
      },
    },
  });

  assert.deepEqual(
    parsed.appointments.map(({ entry }) => entry.title),
    ["Preferred employment"]
  );
  assert.deepEqual(
    parsed.education.map(({ entry }) => entry.title),
    ["Preferred education", "Preferred qualification"]
  );
});
