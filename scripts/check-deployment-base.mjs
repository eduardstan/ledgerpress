import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const web = join(root, "web");
const dist = join(web, "dist");
const stagedCv = join(web, "public/assets/cv.pdf");
const site = "https://example.github.io/ledgerpress-proof/";
const base = "/ledgerpress-proof/";
const stagedFixture = !existsSync(stagedCv);

if (stagedFixture) {
  mkdirSync(dirname(stagedCv), { recursive: true });
  writeFileSync(stagedCv, "%PDF-1.4\n% deployment-path fixture\n");
}

try {
  const build = spawnSync("npm", ["run", "build"], {
    cwd: web,
    encoding: "utf8",
    env: { ...process.env, LEDGERPRESS_SITE: site },
  });
  if (build.stdout) process.stdout.write(build.stdout);
  if (build.stderr) process.stderr.write(build.stderr);
  if (build.error) throw build.error;
  assert.equal(build.status, 0, `subpath build exited with ${build.status}`);

  const text = (path) => readFileSync(join(dist, path), "utf8");
  const home = text("index.html");
  assert.match(home, /href="\/ledgerpress-proof\/publications\/"/);
  assert.match(home, /src="\/ledgerpress-proof\/media\/portrait\.svg"/);
  assert.match(home, /href="\/ledgerpress-proof\/fonts\/Archivo-Black\.woff2"/);

  const styles = readdirSync(join(dist, "_astro"))
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
  assert.ok(existsSync(join(dist, "assets/cv.pdf")));
  process.stdout.write("ok — project-subpath routes and assets share one deployment base\n");
} finally {
  if (stagedFixture) rmSync(stagedCv);
}
