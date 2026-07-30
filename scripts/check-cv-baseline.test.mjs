import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(root, "scripts/check-cv-baseline.sh");
const owner = "Sahana Aster KŌWHAI, Ph.D.";

function fixture(record, metadata = `Owner: ${owner}\nPages: 2\n`, node = process.execPath) {
  const directory = mkdtempSync(join(tmpdir(), "ledgerpress-baseline-"));
  for (const path of ["content", "data/cv-baseline", "cv", "bin"]) {
    mkdirSync(join(directory, path), { recursive: true });
  }
  writeFileSync(join(directory, "content/cv.yaml"), record);
  writeFileSync(join(directory, "data/cv-baseline/cv-baseline-meta.txt"), metadata);
  writeFileSync(join(directory, "data/cv-baseline/cv-baseline.txt"), "baseline\n");
  writeFileSync(join(directory, "cv/cv.pdf"), "fixture\n");
  writeFileSync(join(directory, "bin/pdftotext"), "#!/bin/sh\nprintf 'baseline\\n'\n");
  writeFileSync(join(directory, "bin/pdfinfo"), "#!/bin/sh\nprintf 'Pages: 2\\n'\n");
  writeFileSync(join(directory, "bin/node"), `#!/bin/sh\nexec ${node} "$@"\n`);
  for (const command of ["pdftotext", "pdfinfo", "node"]) {
    chmodSync(join(directory, `bin/${command}`), 0o755);
  }
  return directory;
}

function run(record, metadata, node) {
  const directory = fixture(record, metadata, node);
  try {
    return spawnSync("bash", [script], {
      cwd: directory,
      encoding: "utf8",
      env: { ...process.env, PATH: `${join(directory, "bin")}:${process.env.PATH}` },
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("profile.name is parsed as YAML at any indentation and without decoys", () => {
  const records = [
    `profile:\n  name: ${owner}\n`,
    `profile:\n    name: ${owner}\n`,
    `profile:\n  name: '${owner}'\n`,
    `profile:\n  name: "${owner}"\n`,
    `profile:\n  name: ${owner} # baseline owner\n`,
    `other:\n  name: Someone Else\nprofile:\n  name: ${owner}\n`,
  ];
  for (const record of records) {
    const result = run(record);
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /Skipped:/);
  }
});

test("a genuine owner change is the only successful skip", () => {
  const result = run("profile:\n  name: Someone Else\n");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Skipped:/);
});

test("an undetermined owner fails closed", () => {
  const cases = [
    ["profile:\n  name: Someone\n", "Pages: 2\n"],
    ["profile:\n  headline: Researcher\n", undefined],
    ["profile:\n  name:\n    given: Sahana\n", undefined],
    ["profile:\n  name: [broken\n", undefined],
  ];
  for (const [record, metadata] of cases) {
    const result = run(record, metadata);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /could not|does not name/);
  }
});

test("an unavailable YAML parser fails closed", () => {
  const result = run(`profile:\n  name: ${owner}\n`, undefined, "/bin/false");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /profile\.name could not be determined/);
});
