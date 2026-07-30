import assert from "node:assert/strict";
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = join(root, "scripts/check-cv-baseline.sh");
const ownerHelper = join(root, "scripts/read-cv-owner.mjs");
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
    return runFrom(directory, script);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function runFrom(directory, baselineScript) {
  return spawnSync("bash", [baselineScript], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, PATH: `${join(directory, "bin")}:${process.env.PATH}` },
  });
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

test("the helper runs from paths containing spaces and through symlinks", () => {
  const directory = mkdtempSync(join(tmpdir(), "ledgerpress helper path "));
  try {
    const record = join(directory, "cv.yaml");
    writeFileSync(record, `profile:\n  name: ${owner}\n`);

    const spacedDirectory = join(directory, "path with spaces");
    mkdirSync(spacedDirectory);
    symlinkSync(join(root, "node_modules"), join(directory, "node_modules"), "dir");
    const spacedHelper = join(spacedDirectory, "read cv owner.mjs");
    copyFileSync(ownerHelper, spacedHelper);
    const spaced = spawnSync(process.execPath, [spacedHelper, record], { encoding: "utf8" });
    assert.equal(spaced.status, 0, spaced.stderr);
    assert.equal(spaced.stdout, owner);

    const linkedHelper = join(directory, "owner-helper.mjs");
    symlinkSync(ownerHelper, linkedHelper);
    const linked = spawnSync(process.execPath, [linkedHelper, record], { encoding: "utf8" });
    assert.equal(linked.status, 0, linked.stderr);
    assert.equal(linked.stdout, owner);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the shell rejects empty successful helper output", () => {
  const directory = fixture(`profile:\n  name: ${owner}\n`);
  try {
    const scripts = join(directory, "scripts");
    mkdirSync(scripts);
    const baselineScript = join(scripts, "check-cv-baseline.sh");
    copyFileSync(script, baselineScript);
    writeFileSync(join(scripts, "read-cv-owner.mjs"), "");
    const result = runFrom(directory, baselineScript);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /profile\.name could not be determined/);
    assert.doesNotMatch(result.stdout, /Skipped:/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
