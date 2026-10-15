import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const hosting = JSON.parse(await readFile(resolve(root, '.openai/hosting.json'), 'utf8'));
if (hosting.static || hosting.d1 !== 'DB') {
  throw new Error('View counts require a Worker hosting manifest with d1: "DB" and no static field.');
}

const index = JSON.parse(await readFile(resolve(root, 'dist/client/search-index.json'), 'utf8'));
const slugs = [...new Set(index
  // Topic pages and the archive share this section; only individual posts count.
  .filter((entry) => entry.section === 'Blog Posts' && entry.id.startsWith('blog-'))
  .map((entry) => {
    const match = /^\/blog\/([a-z0-9][a-z0-9-]{0,119})\/$/.exec(entry.url);
    if (!match) throw new Error(`Unsupported blog URL in search index: ${entry.url}`);
    return match[1];
  }))];

await mkdir(resolve(root, 'dist/server'), { recursive: true });
await build({
  entryPoints: [resolve(root, 'worker/index.ts')],
  outfile: resolve(root, 'dist/server/index.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  define: { __BLOG_SLUGS__: JSON.stringify(slugs) },
});

const wrangler = JSON.parse(await readFile(resolve(root, 'wrangler.json'), 'utf8'));
await writeFile(resolve(root, 'dist/server/wrangler.json'), JSON.stringify({
  ...wrangler,
  main: './index.js',
  assets: { ...wrangler.assets, directory: '../client' },
  d1_databases: wrangler.d1_databases.map((database) => ({ ...database, migrations_dir: '../.openai/drizzle' })),
}, null, 2) + '\n');

await mkdir(resolve(root, 'dist/.openai'), { recursive: true });
await cp(resolve(root, '.openai/hosting.json'), resolve(root, 'dist/.openai/hosting.json'));
await cp(resolve(root, 'drizzle'), resolve(root, 'dist/.openai/drizzle'), { recursive: true });
console.log(`Built view-count Worker for ${slugs.length} blog posts.`);
