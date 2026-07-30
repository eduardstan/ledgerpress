/**
 * Redirects for addresses an adopter's previous site published.
 *
 * Add old paths here during a migration; `astro.config.mjs` applies the
 * deployment base to each destination before passing this map to Astro.
 */
export const legacyRedirects: Record<string, string> = {
  '/professional_activities/': '/service/',
};
