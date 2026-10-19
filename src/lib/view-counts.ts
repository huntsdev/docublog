import { Redis } from '@upstash/redis';

type ViewCollection = 'blog' | 'projects';
export interface ViewStore {
  read(slugs: string[], collection?: ViewCollection): Promise<(number | null)[]>;
  increment(slug: string, collection?: ViewCollection): Promise<number>;
}

interface UpstashConfig {
  url?: string;
  token?: string;
  namespace: string;
}

export function createUpstashViewStore({ url, token, namespace }: UpstashConfig): ViewStore | undefined {
  if (!url || !token) return undefined;
  // Retrying INCR after a lost response could count the same request twice.
  const redis = new Redis({ url, token, retry: false, signal: () => AbortSignal.timeout(5000) });
  const key = (slug: string, collection: ViewCollection) => `${namespace}:${collection === 'projects' ? 'project' : 'post'}:${slug}`;
  return {
    read: (slugs, collection = 'blog') => redis.mget<(number | null)[]>(...slugs.map(slug => key(slug, collection))),
    increment: (slug, collection = 'blog') => redis.incr(key(slug, collection)),
  };
}

const json = (body: unknown, status = 200, extraHeaders?: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });

function validCount(value: number | null | undefined): number {
  if (value === null) return 0;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid view count');
  return value;
}

/** Aggregate article views with the same 30-minute browser deduplication as before. */
export function createViewHandler(blogSlugs: readonly string[], store?: ViewStore, projectSlugs: readonly string[] = []) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const collection = url.searchParams.get('collection') || 'blog';
    if (collection !== 'blog' && collection !== 'projects') return json({ error: 'Unknown collection' }, 400);
    const knownSlugs = new Set(collection === 'projects' ? projectSlugs : blogSlugs);
    const path = url.pathname.replace(/\/+$/, '');
    if (path === '/api/views') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, { Allow: 'GET' });
      const slugs = [...new Set((url.searchParams.get('slugs') ?? '').split(',').filter(Boolean))];
      if (!slugs.length || slugs.length > 100 || slugs.some(slug => !knownSlugs.has(slug))) {
        return json({ error: 'Provide between 1 and 100 published post or project slugs' }, 400);
      }
      if (!store) return json({ error: 'Views are temporarily unavailable' }, 503);
      try {
        const counts = await store.read(slugs, collection);
        const views = Object.fromEntries(slugs.map((slug, index) => [slug, validCount(counts[index])]));
        return json({ views });
      } catch {
        return json({ error: 'Views are temporarily unavailable' }, 503);
      }
    }

    const match = /^\/api\/views\/([a-z0-9][a-z0-9-]{0,119})$/.exec(path);
    if (!match || !knownSlugs.has(match[1])) return json({ error: 'Not found' }, 404);
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
    const origin = request.headers.get('Origin');
    const fetchSite = request.headers.get('Sec-Fetch-Site');
    if ((origin && origin !== url.origin) || (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none')) {
      return json({ error: 'Cross-origin requests are not allowed' }, 403);
    }
    if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return json({ error: 'Use application/json' }, 415);
    }
    if (!store) return json({ error: 'Views are temporarily unavailable' }, 503);
    const slug = match[1];
    const cookieName = `hunts-view-${collection === 'projects' ? 'project-' : ''}${slug}`;
    const counted = (request.headers.get('Cookie') ?? '').split(';').some(cookie => cookie.trim() === `${cookieName}=1`);
    try {
      const views = validCount(counted ? (await store.read([slug], collection))[0] : await store.increment(slug, collection));
      if (counted) return json({ slug, views });
      const cookie = `${cookieName}=1; Max-Age=1800; Path=/api/views/${slug}; HttpOnly; SameSite=Lax${url.protocol === 'https:' ? '; Secure' : ''}`;
      return json({ slug, views }, 200, { 'Set-Cookie': cookie });
    } catch {
      return json({ error: 'Views are temporarily unavailable' }, 503);
    }
  };
}
