import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { build } from 'esbuild';

const bundled = await build({
  entryPoints: ['src/lib/view-counts.ts'],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'node22',
});
const { createViewHandler, createUpstashViewStore } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const slugs = ['first-post', 'second-post'];
function memoryStore() {
  const counts = new Map();
  return {
    async read(slugs) { return slugs.map(slug => counts.get(slug) ?? null); },
    async increment(slug) {
      const views = (counts.get(slug) ?? 0) + 1;
      counts.set(slug, views);
      return views;
    },
  };
}
const post = (slug = 'first-post', headers = {}) => new Request(`https://hunts.example/api/views/${slug}/`, {
  method: 'POST',
  headers: { Origin: 'https://hunts.example', 'Content-Type': 'application/json', ...headers },
  body: '{}',
});
const get = (slugs = 'first-post,second-post') => new Request(`https://hunts.example/api/views/?slugs=${encodeURIComponent(slugs)}`);

test('counts persist and refreshes share a 30-minute browser cookie', async () => {
  const store = memoryStore();
  const handle = createViewHandler(slugs, store);
  assert.deepEqual(await (await handle(get())).json(), { views: { 'first-post': 0, 'second-post': 0 } });
  const first = await handle(post());
  assert.deepEqual(await first.json(), { slug: 'first-post', views: 1 });
  const cookie = first.headers.get('Set-Cookie');
  assert.match(cookie, /Max-Age=1800/);
  assert.match(cookie, /Path=\/api\/views\/first-post; HttpOnly; SameSite=Lax; Secure/);
  const refresh = await createViewHandler(slugs, store)(post('first-post', { Cookie: cookie.split(';')[0] }));
  assert.deepEqual(await refresh.json(), { slug: 'first-post', views: 1 });
  assert.equal(refresh.headers.get('Set-Cookie'), null);
  assert.equal((await (await handle(post())).json()).views, 2);
  const counts = await handle(get());
  assert.deepEqual(await counts.json(), { views: { 'first-post': 2, 'second-post': 0 } });
  assert.equal(counts.headers.get('Cache-Control'), 'no-store');
});

test('invalid origins, unpublished posts, methods, and content types never count', async () => {
  const handle = createViewHandler(slugs, memoryStore());
  assert.equal((await handle(post('first-post', { Origin: 'https://unrelated.example' }))).status, 403);
  assert.equal((await handle(post('first-post', { 'Sec-Fetch-Site': 'cross-site' }))).status, 403);
  assert.equal((await handle(post('nonexistent'))).status, 404);
  assert.equal((await handle(get('first-post,nonexistent'))).status, 400);
  assert.equal((await handle(get("first-post'); DROP TABLE post_views;--"))).status, 400);
  assert.equal((await handle(get(''))).status, 400);
  const head = await handle(new Request('https://hunts.example/api/views/first-post/', { method: 'HEAD' }));
  assert.equal(head.status, 405);
  assert.equal(head.headers.get('Allow'), 'POST');
  assert.equal((await handle(new Request('https://hunts.example/api/views/', { method: 'POST' }))).status, 405);
  for (const type of ['text/plain', 'application/jsonp']) {
    assert.equal((await handle(post('first-post', { 'Content-Type': type }))).status, 415);
  }
  assert.deepEqual(await (await handle(get())).json(), { views: { 'first-post': 0, 'second-post': 0 } });
});

test('bulk reads accept at most 100 published slugs and support both URL forms', async () => {
  const published = Array.from({ length: 101 }, (_, index) => `post-${index}`);
  const handle = createViewHandler(published, memoryStore());
  assert.equal((await handle(get(published.join(',')))).status, 400);
  const response = await handle(get(published.slice(0, 100).join(',')));
  assert.equal(Object.keys((await response.json()).views).length, 100);
  const normal = createViewHandler(slugs, memoryStore());
  assert.equal((await normal(new Request('https://hunts.example/api/views?slugs=first-post'))).status, 200);
  assert.equal((await normal(new Request('https://hunts.example/api/views/first-post', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  }))).status, 200);
});

test('missing configuration, outages, and corrupt counts never return a success cookie or invented counts', async () => {
  assert.equal(createUpstashViewStore({ namespace: 'test' }), undefined);
  const unavailable = { async read() { throw new Error('offline'); }, async increment() { throw new Error('offline'); } };
  for (const store of [undefined, unavailable, { async read() { return [-1]; }, async increment() { return NaN; } }]) {
    const handle = createViewHandler(slugs, store);
    for (const request of [get(), post(), post('first-post', { Cookie: 'hunts-view-first-post=1' })]) {
      const response = await handle(request);
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('Set-Cookie'), null);
      assert.equal((await response.json()).views, undefined);
    }
  }
});

test('the real Upstash client uses authenticated atomic increments, bulk reads, and isolated namespaces', async t => {
  const counts = new Map();
  const commands = [];
  const authorizations = [];
  const server = createServer(async (request, response) => {
    authorizations.push(request.headers.authorization);
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const pipeline = Array.isArray(body[0]);
    const results = (pipeline ? body : [body]).map(command => {
      commands.push(command);
      const [operation, ...keys] = command;
      if (operation.toLowerCase() === 'incr') {
        const value = (counts.get(keys[0]) ?? 0) + 1;
        counts.set(keys[0], value);
        return { result: value };
      }
      if (operation.toLowerCase() === 'mget') return { result: keys.map(key => counts.get(key) ?? null) };
      return { error: 'Unexpected command' };
    });
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(pipeline ? results : results[0]));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const config = { url: `http://127.0.0.1:${server.address().port}`, token: 'test-token' };
  const store = createUpstashViewStore({ ...config, namespace: 'production' });
  const handle = createViewHandler(slugs, store);
  const responses = await Promise.all(Array.from({ length: 20 }, () => handle(post())));
  assert.ok(responses.every(response => response.status === 200));
  assert.deepEqual(await (await handle(get())).json(), { views: { 'first-post': 20, 'second-post': 0 } });
  const development = createUpstashViewStore({ ...config, namespace: 'development' });
  assert.deepEqual(await development.read(slugs), [null, null]);
  const scoped = createViewHandler(slugs, store, ['first-post']);
  const projectRequest = (cookie) => new Request('https://hunts.example/api/views/first-post/?collection=projects', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: '{}',
  });
  const projectResponse = await scoped(projectRequest());
  assert.equal((await projectResponse.json()).views, 1);
  const projectCookie = projectResponse.headers.get('Set-Cookie');
  assert.match(projectCookie, /^hunts-view-project-first-post=1;/);
  assert.equal((await (await scoped(projectRequest(projectCookie.split(';')[0]))).json()).views, 1);
  assert.deepEqual(await store.read(['first-post'], 'projects'), [1]);
  assert.deepEqual(await store.read(['first-post']), [20]);
  assert.equal((await scoped(new Request('https://hunts.example/api/views/?collection=projects&slugs=second-post'))).status, 400);
  assert.equal((await scoped(new Request('https://hunts.example/api/views/?collection=unknown&slugs=first-post'))).status, 400);
  assert.ok(authorizations.every(value => value === 'Bearer test-token'));
  assert.equal(commands.filter(command => command[0].toLowerCase() === 'incr').length, 21);
  assert.ok(commands.some(command => command[0].toLowerCase() === 'mget' && command.length === 3));
});
