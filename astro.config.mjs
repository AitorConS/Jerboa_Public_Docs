import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import { pageIndex, sitemapFields } from './src/lib/seo.mjs';
import { rehypeImgDimensions } from './src/lib/rehype-img-dimensions.mjs';

// Copies the generated urlset to /sitemap.xml. Astro writes sitemap-index.xml
// and sitemap-0.xml; the conventional URL was a 404.
function sitemapXmlAlias() {
  return {
    name: 'sitemap-xml-alias',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const dest = fileURLToPath(dir);
        await copyFile(path.join(dest, 'sitemap-0.xml'), path.join(dest, 'sitemap.xml'));
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
      // `/` only redirects to /getting-started/ (vercel.json); the 404 page is not content.
      filter: (page) => page !== 'https://docs.jerboa.dev/' && !page.includes('/404'),
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
