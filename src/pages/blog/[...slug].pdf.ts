import type { APIRoute, GetStaticPaths } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { render } from 'astro:content';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import reactRenderer from '@astrojs/react/server.js';
import { getPosts } from '../../lib/content';
import { createBlogPdf } from '../../lib/blog-pdf';

export const getStaticPaths: GetStaticPaths = async () => {
  return (await getPosts()).map(post => ({ params: { slug: post.id }, props: { post } }));
};

export const GET: APIRoute = async ({ props }) => {
  const post = props.post as CollectionEntry<'blog'>;
  let html = post.rendered?.html;
  if (html === undefined) {
    const { Content } = await render(post);
    const container = await AstroContainer.create();
    container.addServerRenderer({ name: '@astrojs/react', renderer: reactRenderer });
    html = await container.renderToString(Content);
  }
  const pdf = await createBlogPdf({ title: post.data.title, author: post.data.author, slug: post.id, html });
  const filename = `${post.id.replaceAll('/', '-')}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
};
