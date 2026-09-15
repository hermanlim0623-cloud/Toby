import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// `site` is what makes canonical URLs, the sitemap and absolute OG image
// URLs possible — social scrapers reject relative image paths, so without
// it a pasted link renders as a bare text card.
export default defineConfig({
  site: 'https://toby.dev',
  integrations: [sitemap()],
  build: {
    // One stylesheet beats a waterfall of tiny <link>s for a site this size.
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      // The dive footage already dominates the byte budget; don't let
      // inlined base64 assets pad the JS bundle on top of it.
      assetsInlineLimit: 1024,
    },
  },
});
