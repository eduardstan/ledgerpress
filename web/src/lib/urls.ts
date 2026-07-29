interface HastNode {
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

const normaliseBase = (base: string) => {
  const path = `/${base}`.replace(/\/+/g, '/').replace(/\/+$/, '');
  return path ? `${path}/` : '/';
};

/** The Astro base path implied by the final URL in `profile.site`. */
export function deploymentBase(site: string | URL): string {
  const url = new URL(site);
  if (url.search || url.hash) throw new Error('profile.site must not include a query or fragment');
  return normaliseBase(url.pathname);
}

/** Prefix one root-relative site URL with the configured deployment base. */
export function internalUrl(path: string, base = '/'): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  const prefix = normaliseBase(base);
  return prefix === '/' ? path : `${prefix.slice(0, -1)}${path}`;
}

/** Resolve one root-relative site URL against its published origin and base. */
export function absoluteInternalUrl(path: string, site: string | URL, base = '/'): URL {
  return new URL(internalUrl(path, base), new URL(site).origin);
}

/** Apply the deployment base to root-relative URLs in stylesheet source. */
export function cssInternalUrls(source: string, base: string): string {
  return source.replace(
    /url\((['"])(\/(?!\/)[^'"]+)\1\)/g,
    (_match, quote: string, path: string) => `url(${quote}${internalUrl(path, base)}${quote})`,
  );
}

/** Apply the same base boundary to links and media authored in Markdown. */
export function rehypeInternalUrls(...parameters: unknown[]) {
  const { base } = parameters[0] as { base: string };
  return (tree: unknown) => {
    const visit = (node: HastNode) => {
      for (const property of ['href', 'src']) {
        const value = node.properties?.[property];
        if (typeof value === 'string') node.properties![property] = internalUrl(value, base);
      }
      node.children?.forEach(visit);
    };
    visit(tree as HastNode);
  };
}
