/**
 * Self-check for the consistency gate, against the repository's real data.
 *
 *   cd web && node --experimental-strip-types src/lib/consistency.test.ts
 *
 * Three consumers read one verdict: the page renders it, `astro:build:done`
 * throws on it, and this asserts on it in ~200ms without a full build. The
 * assertion that matters is the first one — the branch is publishable — and the
 * rest guard the properties the gate's usefulness rests on: that it fires on a
 * real contradiction, that an exception excuses exactly one fact and expires,
 * and that it stays silent on a fresh copy of this template.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CHECKS,
  consistency,
  coverage,
  exceptionProblem,
  report,
  restoreRejectedFindings,
} from './consistency.ts';
import { SOURCES } from './record.ts';

const gate = consistency();

// The branch is publishable. This is the assertion `astro build` also makes.
assert.deepEqual(gate.contradictions, [], report(gate));
assert.deepEqual(gate.exceptionProblems, [], report(gate));

// The gate is not decorative: it says how much it looked at, and it looked.
assert.ok(gate.comparisons > 0, `only ${gate.comparisons} comparisons made`);
assert.match(coverage(gate), /\d+ comparisons/);

// The example record needs no exceptions; adopters start from a clean gate.
assert.deepEqual(gate.excused, []);

const ok = {
  check: CHECKS[0].id,
  because: 'both of these dates are independently correct',
  until: '2099-01-01',
};
const exampleFinding = {
  check: CHECKS[0].id,
  subject: 'appointments[0] "Example appointment"',
  source: SOURCES.cv,
  exceptionSource: SOURCES.cv,
  sides: [
    { label: 'dates', value: '2024 – Present', source: `${SOURCES.cv}:10` },
    { label: 'announced', value: '2022-01-02', source: `${SOURCES.cv}:15` },
  ],
  why: 'The announcement year does not match the fact.',
  excused: ok,
};

// A synthetic contradiction proves that the report refuses a build and hands
// over the scoped exception syntax without polluting the example record.
const contradictionReport = report({
  ...gate,
  contradictions: [{ ...exampleFinding, excused: undefined }],
});
assert.match(contradictionReport, /Build refused/);
assert.match(contradictionReport, /except:\n\s+- check: announced-in-own-year/);

const bibliographyContradiction = {
  ...exampleFinding,
  subject: 'paper-key "A paper"',
  source: SOURCES.bibliography,
  exceptionSource: undefined,
  excused: undefined,
};
const bibliographyReport = report({
  ...gate,
  contradictions: [bibliographyContradiction],
  excused: [],
});
assert.match(bibliographyReport, /this record has no exception mechanism/);
assert.doesNotMatch(bibliographyReport, /except:\n/);

// The rules the gate enforces on an exception itself. A typo must never look
// like a successful excuse.
assert.equal(exceptionProblem(ok, 'subject', '2026-01-01'), undefined);
assert.match(exceptionProblem({ ...ok, check: 'no-such-check' }, 's', '2026-01-01')!, /no check/);
assert.match(exceptionProblem({ ...ok, because: 'typo' }, 's', '2026-01-01')!, /no reason/);
assert.match(exceptionProblem({ ...ok, until: 'soon' }, 's', '2026-01-01')!, /no expiry/);
assert.match(exceptionProblem({ ...ok, until: '2027-13-40' }, 's', '2026-01-01')!, /no expiry/);
assert.match(exceptionProblem({ ...ok, until: '2027-02-29' }, 's', '2026-01-01')!, /no expiry/);
assert.equal(exceptionProblem({ ...ok, until: '2028-02-29' }, 's', '2026-01-01'), undefined);
assert.match(exceptionProblem({ ...ok, until: '2025-01-01' }, 's', '2026-01-01')!, /expired/);
assert.equal(exceptionProblem({ ...ok, until: 'permanent' }, 's', '2026-01-01'), undefined);

const multiExcused = [
  { ...exampleFinding, subject: `${exampleFinding.subject} 2025` },
  { ...exampleFinding, subject: `${exampleFinding.subject} 2026` },
];
const restored: typeof multiExcused = [];
restoreRejectedFindings(multiExcused, restored, exampleFinding.subject, exampleFinding.check);
assert.equal(multiExcused.length, 0, 'a rejected entry exception still excused an edition');
assert.equal(restored.length, 2, 'not every edition finding came back');
assert.ok(restored.every((finding) => finding.excused === undefined));

// It cannot fire on a fresh copy of this template. Every comparison needs two
// hand-typed records of one fact; a fresh copy has one — a date — and no second
// one to disagree with it. This is a property of the design, not a threshold:
// with no `announced:` anywhere there is nothing to compare, so nothing fires.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const second = (path: string, pattern: RegExp) =>
  (readFileSync(root + path, 'utf8').match(pattern) ?? []).length;
assert.equal(
  gate.comparisons + gate.uncomparable.length,
  second(SOURCES.cv, /^\s*announced:/gm) + second(SOURCES.bibliography, /^\s*announced\s*=/gm),
  'the gate compared something no second record was written for',
);

console.log(
  `ok — ${coverage(gate)}; ${gate.stale.length} stale exceptions, ` +
    `${gate.uncomparable.length} uncomparable`,
);
