import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build
export default defineConfig({
  site: 'https://docs.jerboa.dev',
  trailingSlash: 'always',
  integrations: [sitemap()],
});
