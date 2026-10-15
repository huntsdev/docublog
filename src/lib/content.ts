import { getCollection } from 'astro:content';

export async function getPosts() {
  return (await getCollection('blog', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}
export async function getProjects() {
  return (await getCollection('projects')).sort((a, b) => Number(b.data.featured) - Number(a.data.featured));
}
export const readingTime = (body = '') => Math.max(1, Math.ceil(body.trim().split(/\s+/).length / 220));
export const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export const tagSlug = (tag: string) => tag.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const socialLinks = [
  { title: 'GitHub', href: 'https://github.com/huntsdev', icon: 'github' },
  { title: 'X / Twitter', href: 'https://x.com/huntsdevv', icon: 'x' },
  { title: 'LinkedIn', href: 'https://linkedin.com/in/ryananthunt', icon: 'linkedin' },
];
