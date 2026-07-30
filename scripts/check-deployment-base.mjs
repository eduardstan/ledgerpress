import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const web = join(root, "web");
const dist = join(web, "dist");
const proofDist = join(web, ".deployment-base-dist");
const stagedCv = join(web, "public/assets/cv.pdf");
const site = "https://example.github.io/ledgerpress-proof/";
const base = "/ledgerpress-proof/";
const stagedFixture = !existsSync(stagedCv);

const snapshot = (directory) => {
  if (!existsSync(directory)) return null;
  const files = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else {
        files.push([relative(directory, path), createHash("sha256").update(readFileSync(path)).digest("hex")]);
      }
    }
  };
  walk(directory);
  return files.sort(([left], [right]) => left.localeCompare(right));
};

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: web,
    encoding: "utf8",
    env: { ...process.env, LEDGERPRESS_SITE: site },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} ${args.join(" ")} exited with ${result.status}`);
};

const publishedBefore = snapshot(dist);

if (stagedFixture) {
  mkdirSync(dirname(stagedCv), { recursive: true });
  writeFileSync(stagedCv, "%PDF-1.4\n% deployment-path fixture\n");
}

try {
  rmSync(proofDist, { recursive: true, force: true });
  run("npm", ["run", "stage-media"]);
  run("npm", ["run", "astro", "--", "build", "--outDir", proofDist]);
  run("npm", ["exec", "--", "pagefind", "--site", proofDist]);

  const text = (path) => readFileSync(join(proofDist, path), "utf8");
  const home = text("index.html");
  assert.match(home, /href="\/ledgerpress-proof\/publications\/"/);
  assert.match(home, /src="\/ledgerpress-proof\/media\/portrait\.svg"/);
  assert.match(home, /href="\/ledgerpress-proof\/fonts\/Archivo-Black\.woff2"/);
  assert.match(home, />7 publications · 1 editorial board</);
  assert.doesNotMatch(home, /1 editorial boards/);

  const styles = readdirSync(join(proofDist, "_astro"))
    .filter((path) => path.endsWith(".css"))
    .map((path) => text(join("_astro", path)))
    .join("\n");
  for (const font of ["Archivo-Black", "LedgerSerif-Regular", "LedgerSerif-Italic", "LedgerSerif-Bold", "GoMono-Regular", "GoMono-Bold"]) {
    assert.ok(styles.includes(`${base}fonts/${font}.woff2`), `${font} lost the deployment base`);
  }

  const post = text("blog/2026/reading-a-core/index.html");
  assert.match(post, /src="\/ledgerpress-proof\/media\/core-layers\.svg"/);

  const search = text("search/index.html");
  assert.match(search, /href="\/ledgerpress-proof\/pagefind\/pagefind-component-ui\.css"/);
  assert.match(search, /src="\/ledgerpress-proof\/pagefind\/pagefind-component-ui\.js"/);
  assert.match(search, /bundle-path="\/ledgerpress-proof\/pagefind\/"/);
  assert.match(search, /base-url="\/ledgerpress-proof\/"/);

  const feed = text("rss.xml");
  assert.ok(feed.includes(`${site}lately/`));
  assert.ok(feed.includes(`${base}blog/2026/reading-a-core/`));
  assert.equal(text("feed.xml"), feed);

  assert.match(text("robots.txt"), /Allow: \/ledgerpress-proof\//);
  assert.ok(text("robots.txt").includes(`${site}sitemap-index.xml`));
  assert.ok(text("sitemap-index.xml").includes(`${site}sitemap-0.xml`));
  assert.ok(text("sitemap-0.xml").includes(`${site}publications/`));

  assert.match(text("cv/index.html"), /href="\/ledgerpress-proof\/assets\/cv\.pdf"/);
  assert.ok(existsSync(join(proofDist, "assets/cv.pdf")));
  process.stdout.write("ok — project-subpath routes and assets share one deployment base\n");
} finally {
  rmSync(proofDist, { recursive: true, force: true });
  if (stagedFixture) rmSync(stagedCv);
  assert.deepEqual(snapshot(dist), publishedBefore, "deployment-base verification changed web/dist, the output reserved for publishing");
}
