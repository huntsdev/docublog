import { getPosts } from '../lib/content';
export async function GET(context: { site: URL }) {
  const escape = (value: string) => value.replace(/[<>&"']/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[ch]!));
  const posts = await getPosts();
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>hunts.dev</title><link>${context.site}</link><description>Practical guides and technical notes from hunts.dev.</description><language>en-us</language>${posts.map(post => `<item><title>${escape(post.data.title)}</title><link>${new URL(`/blog/${post.id}/`,context.site)}</link><guid>${new URL(`/blog/${post.id}/`,context.site)}</guid><description>${escape(post.data.description)}</description><dc:creator>${escape(post.data.author)}</dc:creator><pubDate>${post.data.date.toUTCString()}</pubDate>${post.data.tags.map(tag=>`<category>${escape(tag)}</category>`).join('')}</item>`).join('')}</channel></rss>`;
  return new Response(xml, {headers:{'Content-Type':'application/rss+xml; charset=utf-8'}});
}
