import assert from 'node:assert/strict';
import test from 'node:test';
import { inline } from './inline.ts';
import { inlineHtml } from './record.ts';
import {
  absoluteInternalUrl,
  cssInternalUrls,
  deploymentBase,
  internalUrl,
  rehypeInternalUrls,
} from './urls.ts';

test('root deployment URLs stay byte-identical', () => {
  const paths = [
    '/',
    '/publications/',
    '/fonts/LedgerSerif-Regular.woff2',
    '/media/portrait.svg',
    '/pagefind/',
    '/rss.xml',
    '/sitemap-index.xml',
    '/assets/cv.pdf',
  ];
  assert.equal(deploymentBase('https://example.edu'), '/');
  for (const path of paths) assert.equal(internalUrl(path, '/'), path);
  const css = "src: url('/fonts/LedgerSerif-Regular.woff2') format('woff2');";
  assert.equal(cssInternalUrls(css, '/'), css);
  assert.equal(
    inline('[figure](/media/figure.svg)', '/'),
    '<a href="/media/figure.svg">figure</a>',
  );
  assert.equal(
    absoluteInternalUrl('/cv/', 'https://example.edu', '/').href,
    'https://example.edu/cv/',
  );
});

test('one deployment base prefixes routes, assets, feeds, and media', () => {
  const site = 'https://example.github.io/scholar/';
  const base = deploymentBase(site);
  assert.equal(base, '/scholar/');
  assert.equal(internalUrl('/', base), '/scholar/');
  assert.equal(internalUrl('/pagefind/', base), '/scholar/pagefind/');
  assert.equal(internalUrl('/media/portrait.svg', base), '/scholar/media/portrait.svg');
  assert.equal(
    cssInternalUrls("url('/fonts/LedgerSerif-Bold.woff2')", base),
    "url('/scholar/fonts/LedgerSerif-Bold.woff2')",
  );
  assert.equal(
    absoluteInternalUrl('/sitemap-index.xml', site, base).href,
    'https://example.github.io/scholar/sitemap-index.xml',
  );
});

test('external URLs and document fragments are inert', () => {
  assert.equal(internalUrl('https://example.edu/work', '/scholar/'), 'https://example.edu/work');
  assert.equal(
    internalUrl('//cdn.example.edu/font.woff2', '/scholar/'),
    '//cdn.example.edu/font.woff2',
  );
  assert.equal(internalUrl('#main', '/scholar/'), '#main');
  assert.equal(
    internalUrl('mailto:scholar@example.edu', '/scholar/'),
    'mailto:scholar@example.edu',
  );
});

test('Markdown links and media use the same deployment boundary', () => {
  const tree = {
    children: [
      { properties: { href: '/publications/' } },
      { properties: { src: '/media/figure.svg' } },
      { properties: { href: 'https://example.edu' } },
    ],
  };
  rehypeInternalUrls({ base: '/scholar/' })(tree);
  assert.deepEqual(tree, {
    children: [
      { properties: { href: '/scholar/publications/' } },
      { properties: { src: '/scholar/media/figure.svg' } },
      { properties: { href: 'https://example.edu' } },
    ],
  });
});

test('every inline renderer prefixes nested root-relative targets', () => {
  const base = '/scholar/';
  const expected = 'href="/scholar/media/figure.svg"';
  const rendered = [
    inline('[figure](/media/figure.svg)', base),
    inline('**[figure](/media/figure.svg)**', base),
    inlineHtml('[figure](/media/figure.svg)', base),
  ];
  for (const html of rendered) {
    assert.ok(html.includes(expected), `renderer lost the deployment base: ${html}`);
    assert.ok(!html.includes('href="/media/'), `renderer emitted an origin-root URL: ${html}`);
  }
});
