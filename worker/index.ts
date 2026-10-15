interface Statement {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
}

interface Env {
  DB?: { prepare(sql: string): Statement };
  ASSETS: { fetch(request: Request): Promise<Response> };
}

interface ViewRow {
  slug: string;
  views: number;
}

declare const __BLOG_SLUGS__: string[];

const json = (body: unknown, status = 200, extraHeaders?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });

/** Aggregate views, with a short browser cookie to avoid counting refreshes. */
export function createWorker(blogSlugs: readonly string[]) {
  const knownSlugs = new Set(blogSlugs);

  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);
      if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

      if (url.pathname === '/api/views') {
        if (request.method !== 'GET') {
          return json({ error: 'Method not allowed' }, 405, { Allow: 'GET' });
        }
        const slugs = [...new Set((url.searchParams.get('slugs') ?? '').split(',').filter(Boolean))];
        if (!slugs.length || slugs.length > 100 || slugs.some((slug) => !knownSlugs.has(slug))) {
          return json({ error: 'Provide between 1 and 100 published blog post slugs' }, 400);
        }
        if (!env.DB) return json({ error: 'Views are temporarily unavailable' }, 503);

        try {
          const placeholders = slugs.map(() => '?').join(',');
          const { results } = await env.DB.prepare(
            `SELECT slug, views FROM post_views WHERE slug IN (${placeholders})`,
          ).bind(...slugs).all<ViewRow>();
          const views: Record<string, number> = Object.fromEntries(slugs.map((slug) => [slug, 0]));
          for (const row of results) views[row.slug] = row.views;
          return json({ views });
        } catch {
          return json({ error: 'Views are temporarily unavailable' }, 503);
        }
      }

      const match = /^\/api\/views\/([a-z0-9][a-z0-9-]{0,119})$/.exec(url.pathname);
      if (!match || !knownSlugs.has(match[1])) return json({ error: 'Not found' }, 404);
      if (request.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
      }

      const origin = request.headers.get('Origin');
      const fetchSite = request.headers.get('Sec-Fetch-Site');
      if ((origin && origin !== url.origin) || (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none')) {
        return json({ error: 'Cross-origin requests are not allowed' }, 403);
      }
      if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
        return json({ error: 'Use application/json' }, 415);
      }
      if (!env.DB) return json({ error: 'Views are temporarily unavailable' }, 503);

      const slug = match[1];
      const cookieName = `hunts-view-${slug}`;
      const counted = (request.headers.get('Cookie') ?? '').split(';').some((cookie) => cookie.trim() === `${cookieName}=1`);
      try {
        if (counted) {
          const row = await env.DB.prepare('SELECT slug, views FROM post_views WHERE slug = ?').bind(slug).first<ViewRow>();
          return json({ slug, views: row?.views ?? 0 });
        }

        // One statement increments atomically, including concurrent readers.
        const row = await env.DB.prepare(
          'INSERT INTO post_views (slug, views) VALUES (?, 1) ON CONFLICT(slug) DO UPDATE SET views = post_views.views + 1 RETURNING slug, views',
        ).bind(slug).first<ViewRow>();
        if (!row) throw new Error('View count did not return a row');
        const cookie = `${cookieName}=1; Max-Age=1800; Path=/api/views/${slug}; HttpOnly; SameSite=Lax${url.protocol === 'https:' ? '; Secure' : ''}`;
        return json({ slug, views: row.views }, 200, { 'Set-Cookie': cookie });
      } catch {
        return json({ error: 'Views are temporarily unavailable' }, 503);
      }
    },
  };
}

export default createWorker(__BLOG_SLUGS__);
