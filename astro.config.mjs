import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import { satteri } from '@astrojs/markdown-satteri';
import callouts from './src/lib/markdown-callouts.mjs';

export default defineConfig({
  site: process.env.SITE_URL || 'https://hunts-dev.kindslug32.chatgpt.site',
  outDir: './dist',
  adapter: vercel(),
  trailingSlash: 'always',
  integrations: [react(), mdx(), sitemap()],
  markdown: {
    processor: satteri({ hastPlugins: [callouts] }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      wrap: true,
    },
  },
});
