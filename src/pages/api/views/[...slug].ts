import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';
import { getPosts, getProjects } from '../../../lib/content';
import { createUpstashViewStore, createViewHandler } from '../../../lib/view-counts';

export const prerender = false;

export const ALL: APIRoute = async ({ request }) => {
  const [posts, projects] = await Promise.all([getPosts(), getProjects()]);
  const environment = import.meta.env.DEV ? 'development' : getSecret('VERCEL_ENV') === 'preview' ? 'preview' : 'production';
  const store = createUpstashViewStore({
    url: getSecret('UPSTASH_REDIS_REST_URL'),
    token: getSecret('UPSTASH_REDIS_REST_TOKEN'),
    namespace: getSecret('VIEW_COUNT_NAMESPACE')?.trim() || `hunts:views:${environment}`,
  });
  return createViewHandler(posts.map(post => post.id), store, projects.map(project => project.id))(request);
};
