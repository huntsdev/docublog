import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { DEFAULT_AUTHOR } from './lib/authors';

const base = { title: z.string(), description: z.string(), author: z.string().trim().min(1).default(DEFAULT_AUTHOR) };
const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    ...base,
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    image: z.string().refine(value => {
      if (/^\/(?!\/)/.test(value)) return true;
      try { return ['http:', 'https:'].includes(new URL(value).protocol); }
      catch { return false; }
    }, 'Use a root-relative image path or an HTTP(S) image URL.').optional(),
  }),
});
const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    ...base,
    status: z.enum(['Active', 'In progress', 'Archived']).default('In progress'),
    stack: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    repository: z.url().optional(),
    demo: z.url().optional(),
  }),
});
const about = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/about' }),
  schema: z.object(base),
});
export const collections = { blog, projects, about };
