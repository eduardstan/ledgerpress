import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = process.env.ADOPTER_CHECK_TMPDIR ? resolve(process.env.ADOPTER_CHECK_TMPDIR) : tmpdir();
mkdirSync(temporaryRoot, { recursive: true });
const copy = mkdtempSync(join(temporaryRoot, "adopter-build-"));
const syntheticName = "Alex Newcomer";
const syntheticDomain = "alex-newcomer.example";
/**
 * The heading the synthetic record's `outreach:` section must print under. No
 * `\cvpart` line names it, so it can only appear through \cvAutoSections: this is
 * the end-to-end proof that a section added to content/ reaches the PDF.
 */
const syntheticAutoHeading = "Outreach";
const exampleSurname = "Kōwhai";
const exampleDomain = "sahana-kowhai.example";

function copyTrackedFiles() {
  const result = spawnSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`git ls-files exited with status ${result.status}`);
  }
  const paths = result.stdout.split("\0").filter(Boolean);
  let copied = 0;
  for (const path of paths) {
    if (path.startsWith("content/")) continue;
    const destination = join(copy, path);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(root, path), destination, { recursive: true });
    copied += 1;
  }
  return copied;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: copy,
    encoding: "utf8",
    ...options,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with status ${result.status}`);
  }
}

function grep(needle, expected, options = {}) {
  const dist = join(copy, "web/dist");
  const args = [
    options.word ? "-RIlFw" : "-RIlF",
    ...(options.ignoreCase ? ["-i"] : []),
    "--include=*.html",
    "--include=*.xml",
    "--include=*.json",
    "--include=*.txt",
    "--",
    needle,
    dist,
  ];
  process.stdout.write(`$ grep ${args.map((arg) => JSON.stringify(arg)).join(" ")}\n`);
  const result = spawnSync("grep", args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status > 1) throw new Error(`grep failed with status ${result.status}`);
  const found = result.status === 0;
  if (!found) process.stdout.write("(no matches)\n");
  if (found !== expected) {
    const condition = expected ? "was not derived into" : "leaked into";
    throw new Error(
      `${JSON.stringify(needle)} ${condition} the synthetic adopter build. ` +
        "This second build proves the template works for someone other than the bundled example."
    );
  }
}

let succeeded = false;
try {
  process.stdout.write("Cold-start adopter check: replace content only, then build both outputs.\n");
  const trackedCount = copyTrackedFiles();
  process.stdout.write(`Materialized ${trackedCount} tracked paths; ignored and untracked build outputs were not copied.\n`);
  const stagedCv = join(copy, "web/public/assets/cv.pdf");
  if (existsSync(stagedCv)) {
    throw new Error("the tracked-only fixture copied a staged CV");
  }
  const content = join(copy, "content");
  mkdirSync(join(content, "media"), { recursive: true });
  mkdirSync(join(content, "posts"), { recursive: true });
  writeFileSync(
    join(content, "cv.yaml"),
    `profile:
  name: ${syntheticName}
  site: https://${syntheticDomain}
  headline: Postdoctoral Researcher
  affiliation:
    - label: University of Somewhere
  place: Somewhere, Elsewhere
  email: alex@example.edu
  portrait: portrait.svg
  favicon: favicon.svg
  bio:
    short: ${syntheticName} is a postdoctoral researcher.
    long: I study reliable knowledge systems.

# A date written as an unquoted YAML number, which is a reasonable thing for an
# adopter to write and used to reach the renderers as a number and crash them.
appointments:
  - title: Research fellow
    dates: 2021

# A section cv/cv.tex does not lay out by hand: it must reach the PDF, under the
# heading its own key spells out, with no LaTeX edit at all.
outreach:
  - title: Sediment cores for schools
    org: Somewhere Public Library
    dates: "2026"
`
  );
  writeFileSync(join(content, "publications.bib"), "");
  writeFileSync(join(content, "talks.bib"), "");
  writeFileSync(
    join(content, "media/portrait.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="#246"/></svg>\n'
  );
  writeFileSync(
    join(content, "media/favicon.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#246"/></svg>\n'
  );
  const dependencies = join(root, "web/node_modules");
  if (!existsSync(dependencies)) {
    throw new Error("web/node_modules is missing; install web dependencies before this check");
  }
  const rootDependencies = join(root, "node_modules");
  if (!existsSync(rootDependencies)) {
    throw new Error("root node_modules is missing; install repository dependencies before this check");
  }
  symlinkSync(rootDependencies, join(copy, "node_modules"), "dir");
  symlinkSync(dependencies, join(copy, "web/node_modules"), "dir");

  run("node", ["scripts/build-cv-data.mjs"], { stdio: "inherit" });
  run("latexmk", ["-xelatex", "-interaction=nonstopmode", "-halt-on-error", "-cd", "cv/cv.tex"], {
    stdio: "inherit",
  });
  const pdfText = spawnSync("pdftotext", ["-layout", join(copy, "cv/cv.pdf"), "-"], {
    encoding: "utf8",
  });
  if (pdfText.error) throw pdfText.error;
  if (pdfText.status !== 0) throw new Error(`pdftotext exited with status ${pdfText.status}`);
  if (!pdfText.stdout.includes(syntheticName)) {
    throw new Error(`${JSON.stringify(syntheticName)} was not derived into the synthetic PDF`);
  }
  if (!pdfText.stdout.toLocaleUpperCase().includes(syntheticAutoHeading.toLocaleUpperCase())) {
    throw new Error(
      `the ${JSON.stringify(syntheticAutoHeading)} section of the synthetic record did not print. ` +
        "cv/cv.tex names no such section, so it can only reach the PDF through the generated " +
        "\\cvAutoSections sequence: adding a section to content/ must need no LaTeX edit."
    );
  }
  if (!pdfText.stdout.includes("2021")) {
    throw new Error("the unquoted numeric appointment year was not derived into the synthetic PDF");
  }
  if (pdfText.stdout.toLocaleLowerCase().includes(exampleSurname.toLocaleLowerCase())) {
    throw new Error(`${JSON.stringify(exampleSurname)} leaked into the synthetic PDF`);
  }

  mkdirSync(join(copy, "web/public/assets"), { recursive: true });
  cpSync(join(copy, "cv/cv.pdf"), join(copy, "web/public/assets/cv.pdf"));
  run("npm", ["run", "build"], { cwd: join(copy, "web"), stdio: "inherit" });
  const publishedPdf = join(copy, "web/dist/assets/cv.pdf");
  if (!existsSync(publishedPdf)) {
    throw new Error("the synthetic adopter build did not publish its newly built CV");
  }
  const publishedPdfText = spawnSync("pdftotext", ["-layout", publishedPdf, "-"], {
    encoding: "utf8",
  });
  if (publishedPdfText.error) throw publishedPdfText.error;
  if (publishedPdfText.status !== 0) {
    throw new Error(`pdftotext on the published PDF exited with status ${publishedPdfText.status}`);
  }
  if (!publishedPdfText.stdout.includes(syntheticName)) {
    throw new Error(`${JSON.stringify(syntheticName)} was not derived into the published PDF`);
  }
  if (publishedPdfText.stdout.toLocaleLowerCase().includes(exampleSurname.toLocaleLowerCase())) {
    throw new Error(`${JSON.stringify(exampleSurname)} leaked into the published PDF`);
  }

  grep(syntheticName, true);
  grep(syntheticDomain, true);
  grep("2021", true);
  grep(exampleSurname, false, { ignoreCase: true, word: true });
  grep(exampleDomain, false);
  succeeded = true;
} catch (error) {
  process.stderr.write(`Cold-start adopter check failed: ${error.message}\n`);
  process.stderr.write(`Throwaway build retained at ${copy}\n`);
  process.exitCode = 1;
} finally {
  if (succeeded) rmSync(copy, { recursive: true, force: true });
}
