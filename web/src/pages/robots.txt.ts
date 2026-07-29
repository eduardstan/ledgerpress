import type { APIRoute } from 'astro';
import { absoluteInternalUrl, internalUrl } from '../lib/urls';

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error('Astro site origin is not configured');
  const base = import.meta.env.BASE_URL;
  const sitemap = absoluteInternalUrl('/sitemap-index.xml', site, base);
  return new Response(`User-agent: *\nAllow: ${internalUrl('/', base)}\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
