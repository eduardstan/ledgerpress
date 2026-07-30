import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const web = join(root, "web");
const dist = join(web, "dist");
const proofDist = join(web, ".deployment-base-dist");
const site = "https://example.github.io/ledgerpress-proof/";
const base = "/ledgerpress-proof/";
const record = load(readFileSync(join(root, "content/cv.yaml"), "utf8"));
const portrait = record?.profile?.portrait == null ? undefined : String(record.profile.portrait);
const htmlAttribute = (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

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

try {
  rmSync(proofDist, { recursive: true, force: true });
  run("npm", ["run", "stage-media"]);
  run("npm", ["run", "astro", "--", "build", "--outDir", proofDist]);
  run("npm", ["exec", "--", "pagefind", "--site", proofDist]);

  const text = (path) => readFileSync(join(proofDist, path), "utf8");
  const home = text("index.html");
  assert.match(home, /href="\/ledgerpress-proof\/publications\/"/);
  assert.ok(home.includes(`property="og:url" content="${site}"`), "og:url lost deployment site base");
  // The home page is not an article, whatever the theme looks like. Which card
  // size the preview asks for is presentation and is not asserted here.
  assert.ok(home.includes('property="og:type" content="website"'));
  if (portrait) {
    assert.ok(home.includes(`src="${htmlAttribute(`${base}media/${portrait}`)}"`), `${portrait} lost the deployment base`);
    if (/\.(?:png|jpe?g|webp)$/i.test(portrait)) {
      assert.ok(home.includes(`property="og:image" content="${site}media/${portrait}"`), `og:image lost deployment site base`);
      assert.ok(home.includes(`name="twitter:image" content="${site}media/${portrait}"`), `twitter:image lost deployment site base`);
    } else {
      assert.doesNotMatch(home, /property="og:image"/);
      assert.doesNotMatch(home, /name="twitter:image"/);
    }
  }
  const alternatePublications = text("publications/year-asc/index.html");
  assert.ok(alternatePublications.includes(`rel="canonical" href="${site}publications/"`));
  assert.doesNotMatch(alternatePublications, /property="og:/);
  assert.doesNotMatch(alternatePublications, /name="twitter:/);
  // The typeface is the adopter's: `content/README.md` invites the code edit that
  // changes it, so no font may be named here. What must hold is that every font
  // reference the build really emitted — the home page's preloads and the built
  // CSS — carries the deployment base. A record that ships no web font simply
  // proves nothing about fonts rather than failing.
  const styles = readdirSync(join(proofDist, "_astro"))
    .filter((path) => path.endsWith(".css"))
    .map((path) => text(join("_astro", path)))
    .join("\n");
  const fontReferences = [...`${home}\n${styles}`.matchAll(/[^"'()\s]*fonts\/[^"'()\s]+\.woff2/g)]
    .map(([reference]) => reference)
    .filter((reference) => !/^(?:https?:)?\/\//.test(reference));
  for (const reference of fontReferences) {
    assert.ok(reference.startsWith(`${base}fonts/`), `the font reference ${reference} lost the deployment base`);
  }

  const search = text("search/index.html");
  assert.match(search, /href="\/ledgerpress-proof\/pagefind\/pagefind-component-ui\.css"/);
  assert.match(search, /src="\/ledgerpress-proof\/pagefind\/pagefind-component-ui\.js"/);
  assert.match(search, /bundle-path="\/ledgerpress-proof\/pagefind\/"/);
  assert.match(search, /base-url="\/ledgerpress-proof\/"/);

  // Which announcements the feed carries is the adopter's record — a record with
  // none is valid — so nothing here requires an item. Every link the feed did
  // emit, the channel's own included, is absolute under the deployment site.
  const feed = text("rss.xml");
  const siteRoot = site.replace(/\/$/, "");
  for (const [, link] of feed.matchAll(/<link>([^<]+)<\/link>/g)) {
    assert.ok(link === siteRoot || link.startsWith(site), `the feed link ${link} lost the deployment site base`);
  }
  assert.equal(text("feed.xml"), feed);

  // The posts are the adopter's, so nothing here names one. Whichever posts the
  // record holds, their routes reach the feed under the deployment base, and a
  // record with none simply proves nothing about posts rather than failing.
  const posts = existsSync(join(proofDist, "blog"))
    ? readdirSync(join(proofDist, "blog"), { recursive: true })
        .filter((path) => path.endsWith(`${sep}index.html`))
        .map((path) => `blog/${path.split(sep).slice(0, -1).join("/")}/`)
    : [];
  for (const route of posts) {
    assert.ok(feed.includes(`${base}${route}`), `${route} is missing from the feed under ${base}`);
  }

  // An internal URL that lost the base is a 404 on a project site, on whichever
  // page it sits — including a media file embedded in an adopter's own post. The
  // prefixes are every asset and route directory this template publishes, so a
  // new route has to be added here to be covered; the base itself comes from the
  // constant the build was given, so the two cannot disagree.
  const pages = readdirSync(proofDist, { recursive: true }).filter((path) => path.endsWith(".html"));
  const prefixes = [
    "_astro",
    "media",
    "assets",
    "fonts",
    "pagefind",
    "blog",
    "lately",
    "search",
    "publications",
    "talks",
    "projects",
    "service",
    "professional_activities",
    "cv",
    "404",
  ];
  const unbased = new RegExp(`(?:src|href|content)="/(?!${base.slice(1)})(?:${prefixes.join("|")})(?:/|")`);
  for (const page of pages) {
    assert.doesNotMatch(text(page), unbased, `${page}: an internal URL lost the deployment base`);
  }

  assert.match(text("robots.txt"), /Allow: \/ledgerpress-proof\//);
  assert.ok(text("robots.txt").includes(`${site}sitemap-index.xml`));
  assert.ok(text("sitemap-index.xml").includes(`${site}sitemap-0.xml`));
  assert.ok(text("sitemap-0.xml").includes(`${site}publications/`));

  // `web/src/pages/cv.astro` offers the printed CV only when the file was really
  // staged, so this follows the page: when the offer is there its link carries
  // the base, and a repository that builds no PDF is a configuration the code
  // itself supports rather than a failure.
  const printedCv = text("cv/index.html").match(/href="([^"]*assets\/cv\.pdf)"/);
  if (printedCv) {
    assert.equal(printedCv[1], `${base}assets/cv.pdf`, "the printed CV link lost the deployment base");
  }
  process.stdout.write("ok — project-subpath routes and assets share one deployment base\n");
} finally {
  rmSync(proofDist, { recursive: true, force: true });
  assert.deepEqual(snapshot(dist), publishedBefore, "deployment-base verification changed web/dist, the output reserved for publishing");
}
