import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readdir, readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const bundled = await build({
  entryPoints: ['worker/index.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  target: 'es2022',
  define: { __BLOG_SLUGS__: JSON.stringify(['first-post', 'second-post']) },
});
const { createWorker } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const worker = createWorker(['first-post', 'second-post']);
const migrations = await Promise.all((await readdir('drizzle')).filter((file) => file.endsWith('.sql')).sort()
  .map((file) => readFile(`drizzle/${file}`, 'utf8')));

function database(t) {
  const sqlite = new DatabaseSync(':memory:');
  for (const sql of migrations) sqlite.exec(sql);
  t.after(() => sqlite.close());
  return {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let parameters = [];
      return {
        bind(...values) { parameters = values; return this; },
        async first() { return statement.get(...parameters) ?? null; },
        async all() { return { results: statement.all(...parameters) }; },
      };
    },
  };
}

const post = (slug = 'first-post', headers = {}) => new Request(`https://hunts.example/api/views/${slug}`, {
  method: 'POST',
  headers: { Origin: 'https://hunts.example', 'Content-Type': 'application/json', ...headers },
  body: '{}',
});
const get = (slugs = 'first-post,second-post') => new Request(`https://hunts.example/api/views?slugs=${encodeURIComponent(slugs)}`);

test('counts persist in the database and refreshes share a 30-minute browser cookie', async (t) => {
  const env = { DB: database(t) };
  const initial = await worker.fetch(get(), env);
  assert.deepEqual(await initial.json(), { views: { 'first-post': 0, 'second-post': 0 } });

  const first = await worker.fetch(post(), env);
  assert.deepEqual(await first.json(), { slug: 'first-post', views: 1 });
  const cookie = first.headers.get('Set-Cookie');
  assert.match(cookie, /Max-Age=1800/);
  assert.match(cookie, /HttpOnly; SameSite=Lax; Secure/);
  const refresh = await worker.fetch(post('first-post', { Cookie: cookie.split(';')[0] }), env);
  assert.deepEqual(await refresh.json(), { slug: 'first-post', views: 1 });
  assert.equal(refresh.headers.get('Set-Cookie'), null);

  const anotherBrowser = await worker.fetch(post(), env);
  assert.equal((await anotherBrowser.json()).views, 2);
  const counts = await worker.fetch(get(), env);
  assert.deepEqual(await counts.json(), { views: { 'first-post': 2, 'second-post': 0 } });
  assert.equal(counts.headers.get('Cache-Control'), 'no-store');
});

test('simultaneous page views increment atomically and only the requested post changes', async (t) => {
  const env = { DB: database(t) };
  const responses = await Promise.all(Array.from({ length: 20 }, () => worker.fetch(post(), env)));
  assert.ok(responses.every((response) => response.status === 200));
  assert.deepEqual(await (await worker.fetch(get(), env)).json(), {
    views: { 'first-post': 20, 'second-post': 0 },
  });
});

test('cross-origin writes, forged slugs, and non-POST article requests never count', async (t) => {
  const env = { DB: database(t) };
  assert.equal((await worker.fetch(post('first-post', { Origin: 'https://unrelated.example' }), env)).status, 403);
  assert.equal((await worker.fetch(post('first-post', { 'Sec-Fetch-Site': 'cross-site' }), env)).status, 403);
  assert.equal((await worker.fetch(post('nonexistent'), env)).status, 404);
  assert.equal((await worker.fetch(get('first-post,nonexistent'), env)).status, 400);
  assert.equal((await worker.fetch(get("first-post'); DROP TABLE post_views;--"), env)).status, 400);
  assert.equal((await worker.fetch(get(''), env)).status, 400);
  const head = await worker.fetch(new Request('https://hunts.example/api/views/first-post', { method: 'HEAD' }), env);
  assert.equal(head.status, 405);
  assert.equal(head.headers.get('Allow'), 'POST');
  assert.equal((await worker.fetch(post('first-post', { 'Content-Type': 'text/plain' }), env)).status, 415);
  assert.deepEqual(await (await worker.fetch(get(), env)).json(), {
    views: { 'first-post': 0, 'second-post': 0 },
  });
});

test('database outages return unavailable without invented counts or a success cookie', async () => {
  for (const env of [{}, { DB: { prepare() { throw new Error('offline'); } } }]) {
    const read = await worker.fetch(get(), env);
    const write = await worker.fetch(post(), env);
    assert.equal(read.status, 503);
    assert.equal(write.status, 503);
    assert.equal(write.headers.get('Set-Cookie'), null);
    assert.equal((await read.json()).views, undefined);
    assert.equal((await write.json()).views, undefined);
  }
});

test('normal routes forward unchanged to the static asset binding', async () => {
  const request = new Request('https://hunts.example/projects/example/');
  let forwarded;
  const response = await worker.fetch(request, {
    ASSETS: { async fetch(incoming) { forwarded = incoming; return new Response('asset response', { status: 404 }); } },
  });
  assert.equal(forwarded, request);
  assert.equal(response.status, 404);
  assert.equal(await response.text(), 'asset response');
});
