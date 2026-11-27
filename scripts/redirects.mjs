// The `redirects` of vercel.json, built from the docs page slugs.
// scripts/sync-docs.mjs writes them, so a page added, removed or renamed in
// jerboa/docs gets its redirects in the same sync. scripts/check-indexing.mjs
// verifies the result. Only real pages and renamed URLs redirect: a missing
// URL must answer 404 on the first request.

/** The fixed redirects: the old home and `/docs` aliases, and the Spark rename. */
export const legacyRedirects = [
  ['/', '/getting-started/'],
  ['/index.html', '/getting-started/'],
  ['/docs', '/getting-started/'],
  ['/docs/', '/getting-started/'],
  ['/docs/index.html', '/getting-started/'],
  ['/macos-firecracker', '/macos-spark/'],
  ['/macos-firecracker/', '/macos-spark/'],
  ['/macos-firecracker.html', '/macos-spark/'],
  ['/docs/macos-firecracker', '/macos-spark/'],
  ['/docs/macos-firecracker/', '/macos-spark/'],
  ['/docs/macos-firecracker.html', '/macos-spark/'],
];

/** The shapes of a page URL that redirect to `/<slug>/`. `:slug` is the page. */
export const pageRedirectShapes = ['/:slug', '/:slug.html', '/docs/:slug', '/docs/:slug/'];

const SLUG = /^[a-z0-9-]+$/;

/** Every redirect for these slugs, in the order vercel.json lists them. */
export function docsRedirects(slugs) {
  for (const slug of slugs) {
    // The slug goes into a path-to-regexp source unescaped.
    if (!SLUG.test(slug)) throw new Error(`A docs page slug must be lowercase letters, digits and hyphens: ${slug}`);
  }
  if (new Set(slugs).size !== slugs.length) throw new Error('Duplicate docs page slug');
  // Longest first, so no alternative is a prefix of one listed after it.
  const alternatives = [...slugs].sort((a, b) => b.length - a.length || (a < b ? -1 : 1)).join('|');
  return [
    ...legacyRedirects.map(([source, destination]) => ({ source, destination, permanent: true })),
    ...pageRedirectShapes.map((shape) => ({
      source: shape.replace(':slug', `:slug(${alternatives})`),
      destination: '/:slug/',
      permanent: true,
    })),
  ];
}

/** vercel.json with its redirects replaced, formatted as the repository keeps it. */
export function withDocsRedirects(vercelJson, slugs) {
  const config = JSON.parse(vercelJson);
  config.redirects = docsRedirects(slugs);
  return `${JSON.stringify(config, null, 2)}\n`;
}
