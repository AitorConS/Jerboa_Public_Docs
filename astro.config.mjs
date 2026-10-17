import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build
export default defineConfig({
  site: 'https://docs.jerboa.dev',
  trailingSlash: 'always',
  integrations: [sitemap()],
  // Fetch a docs page when its link is hovered or focused, so the
  // ClientRouter swap has nothing left to download.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  // Code colours come from the design tokens (see Docs.astro), not from a Shiki theme.
  markdown: { shikiConfig: { theme: 'css-variables' } },
});
