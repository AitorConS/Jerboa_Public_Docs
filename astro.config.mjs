import { copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import { isCanonicalSitemapUrl, pageIndex, sitemapFields } from './src/lib/seo.mjs';
import { rehypeImgDimensions } from './src/lib/rehype-img-dimensions.mjs';

function pageLocs(xml) {
  return [...xml.matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

// Copies the generated urlset to /sitemap.xml and refuses any loc that is not
// a canonical docs page. Astro writes sitemap-index.xml and sitemap-0.xml;
// the conventional URL was a 404.
function sitemapXmlAlias() {
  return {
    name: 'sitemap-xml-alias',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const dest = fileURLToPath(dir);
        await copyFile(path.join(dest, 'sitemap-0.xml'), path.join(dest, 'sitemap.xml'));
        const urlset = await readFile(path.join(dest, 'sitemap-0.xml'), 'utf8');
        const alias = await readFile(path.join(dest, 'sitemap.xml'), 'utf8');
        const index = await readFile(path.join(dest, 'sitemap-index.xml'), 'utf8');
        if (alias !== urlset) throw new Error('sitemap.xml is not a copy of sitemap-0.xml');
        const actual = pageLocs(urlset).sort();
        const expected = [...pageIndex().byUrl.keys()].sort();
        if (actual.join('\n') !== expected.join('\n')) {
          const extra = actual.filter((url) => !expected.includes(url));
          const missing = expected.filter((url) => !actual.includes(url));
          throw new Error(
            `Sitemap must list only canonical pages.\nextra: ${extra.join(', ') || 'none'}\nmissing: ${missing.join(', ') || 'none'}`,
          );
        }
        const indexLocs = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
        if (indexLocs.length !== 1 || indexLocs[0] !== 'https://docs.jerboa.dev/sitemap-0.xml') {
          throw new Error(`sitemap-index.xml should list only sitemap-0.xml, got ${indexLocs.join(', ') || 'nothing'}`);
        }
        for (const item of pageIndex().missingAlt) logger.warn(`Image missing a descriptive alt: ${item}`);
      },
    },
  };
}

// https://astro.build
export default defineConfig({
  site: 'https://docs.jerboa.dev',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // Only real docs pages. `/` redirects, and the 404 page is not content.
      filter: (page) => isCanonicalSitemapUrl(page),
      serialize(item) {
        const meta = pageIndex().byUrl.get(item.url);
        return { ...item, ...sitemapFields(item.url, meta) };
      },
    }),
    sitemapXmlAlias(),
  ],
  // Fetch a docs page when its link is hovered or focused, so the
  // ClientRouter swap has nothing left to download.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  // Code colours come from the design tokens (see Docs.astro), not from a Shiki theme.
  // The remark/rehype processor, as before Astro 7 made Sätteri the default,
  // so the published HTML and the image-dimension plugin stay the same.
  markdown: { processor: unified({ rehypePlugins: [rehypeImgDimensions] }), shikiConfig: { theme: 'css-variables' } },
});
