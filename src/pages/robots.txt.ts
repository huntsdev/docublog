export function GET(context: { site: URL }) {
  return new Response(`User-agent: *\nAllow: /\nSitemap: ${new URL('/sitemap-index.xml', context.site)}\n`, {headers:{'Content-Type':'text/plain'}});
}
