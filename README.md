# hunts.dev

A Markdown-first personal blog with the navigation and reading experience of a documentation site. Built with Astro, React, accessible Radix components, MiniSearch, and a small Cloudflare Worker for durable blog view counts.

The included articles, projects, and biography are illustrative starter content. Replace them with your own writing and verify your social links before a public launch.

## Features

- Responsive documentation layout, collapsible navigation, article table of contents, and mobile menu.
- Markdown blog posts, projects, and About page; optional MDX for callouts, link cards, and embedded media.
- Blog topic tags, tag archives, reading time, and blog-only view counts.
- Full-text search with fuzzy and prefix matching, section filters, directory breadcrumbs, and keyboard navigation. Open with `Ctrl/Cmd + K` or `/`.
- Light, dark, and system appearance settings, persisted in the browser.
- Syntax-highlighted code, tables, task lists, quotes, and copyable code blocks.
- RSS, canonical URLs, sitemap, and the supplied hunts.dev logo and favicon assets.

## Run locally

Use Node.js **22.13.0 or newer**. Run commands from the project root.

```sh
npm install
npm run dev
```

`npm run dev` runs the Astro application for fast content and UI editing. It does not run the Worker or D1 API. View counts display an em dash (`—`) when that API is unavailable.

For the complete local application, including working persistent view counts:

```sh
npm run build
npm run db:migrate
npm run preview
```

`npm run preview` serves the built site through Wrangler with its local D1 database. Both migration and preview commands use the project-root `.wrangler/state` directory, so local data survives restarts. Rebuild after changing content when using preview.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Astro content and UI development server |
| `npm run build` | Generate static pages, search index, and Worker deployment artifacts |
| `npm run db:migrate` | Apply D1 migrations to the local database |
| `npm run preview` | Run the built Worker, static assets, and local D1 database |
| `npm run check` | Check Astro and TypeScript files |
| `npm test` | Run the view-count API tests |
| `npm run test:e2e` | Run browser checks against a preview at port 4322 |
| `npm run db:generate` | Generate a migration after changing the database schema |

For browser checks, start `npm run preview -- --port 4322` first. Install Chromium with `npx playwright install chromium` if it is not already available. Set `PLAYWRIGHT_BASE_URL` to test a different preview URL.

## Write content

Content schemas live in `src/content.config.ts`. Use lowercase, hyphenated filenames for blog posts and projects: the filename becomes the URL slug. Blog posts must use a flat filename such as `my-first-post.md`.

### Blog posts

Create `src/content/blog/my-first-post.md`:

```md
---
title: "My first field note"
description: "A practical note about building and learning."
date: 2026-10-14
tags: [PowerShell, Automation]
featured: false
draft: false
---

## Start with the useful part

Write your article using Markdown. Add headings, links, code blocks,
tables, lists, and images as needed.
```

`title`, `description`, and `date` are required. Tags default to an empty list; `featured` and `draft` default to `false`. Draft posts are excluded from published pages, navigation, search, and feeds. Posts are ordered by date, newest first. Tags and view counters apply only to blog posts.

### Projects

Create `src/content/projects/my-project.md`:

```md
---
title: "Active Directory PowerShell Toolkit"
description: "A collection of reusable PowerShell helpers."
status: "In progress"
stack: [PowerShell, Active Directory]
featured: false
repository: "https://github.com/your-handle/your-project"
demo: "https://your-project.example.com"
---

## Overview

Describe the project, how it works, and how to get started.
```

`status` accepts `Active`, `In progress`, or `Archived` and defaults to `In progress`. `stack` defaults to an empty list. `featured`, `repository`, and `demo` are optional; omit links that do not exist. Projects have their own index and navigation entries without blog tags or view counts.

### About

Edit `src/content/about/index.md`. Its frontmatter requires `title` and `description`; its body is ordinary Markdown.

### Rich content and embeds

Use `.mdx` when you need imported components. MDX uses the same collection frontmatter as Markdown. The complete reference is `examples/rich-content.mdx`.

For an MDX file directly inside `src/content/blog` or `src/content/projects`:

```mdx
import Callout from '../../components/mdx/Callout.astro';
import Embed from '../../components/mdx/Embed.astro';
import LinkCard from '../../components/mdx/LinkCard.astro';

<Callout variant="tip" title="Keep a useful note">

You can use **Markdown formatting** inside a callout.

</Callout>

<LinkCard
  href="/projects/"
  title="Explore the projects"
  description="Tools, experiments, and things in progress."
/>

<Embed
  src="https://www.youtube-nocookie.com/embed/VIDEO_ID"
  title="A descriptive video title"
  caption="Optional context for the video."
/>
```

`Callout` supports `note`, `tip`, and `warning`. `LinkCard` accepts a root-relative internal URL or an HTTPS external URL. `Embed` requires an HTTPS embed URL and an accessible title; supported providers are YouTube, Vimeo, CodePen, and Spotify. Use the provider's embed URL rather than its regular watch or share URL. Unsupported URLs fail the build with a descriptive error.

Put images and other downloadable assets in `public/` and reference them with root-relative paths, such as `![Diagram description](/images/diagram.png)`.

## Search and personalization

The build automatically generates `/search-index.json` from published content. Search covers titles, descriptions, full article and project text, section names, and blog tags. Results show the content directory, for example `Projects > Active Directory PowerShell Toolkit`. MiniSearch loads only when the search dialog first opens; no external search service is required.

Update GitHub, X, and LinkedIn URLs in `src/lib/content.ts`. The supplied logo and favicon files live in `public/`; `site.webmanifest` supplies the app icon metadata. Shared layout and styles live in `src/layouts/` and `src/styles/`.

## What a view means

Blog views are stored durably in D1 and start at zero. A visit increments the count only when the individual blog article is visible. A browser cookie prevents repeated increments for the same article within 30 minutes. Counts are aggregate pageviews, not a count of unique people. Projects and the About page never record views.

When the view API is unavailable, the interface shows `—` rather than an invented count. The local D1 database and a deployed D1 database are separate; local preview activity does not populate production counts.

## Canonical URL and deployment

The default canonical site URL is the private Sites preview URL, `https://hunts-dev.kindslug32.chatgpt.site`. Set `SITE_URL` when building for your own domain so canonical links, sitemap, and RSS use the correct origin.

PowerShell:

```powershell
$env:SITE_URL = 'https://hunts.dev'
npm run build
```

The site is portable to Cloudflare Workers with D1. `wrangler.json` defines the Worker, static assets, and the `DB` binding. `scripts/build-worker.mjs` bundles the Worker into `dist/server` and writes the deployment configuration alongside it. Static output is in `dist/client`.

For your own Cloudflare deployment, create a D1 database and update its name and ID in `wrangler.json`. Apply the migrations to that database, then build and deploy:

```sh
npx wrangler d1 migrations apply DB --remote --config wrangler.json
npm run build
npx wrangler deploy --config dist/server/wrangler.json
```

Keep `.openai/hosting.json` when using Sites: it identifies the existing private project and declares its Worker/D1 hosting requirements. Keep its project ID intact. Store credentials in provider-managed secrets or local environment files; never put secrets in the hosting manifest or commit them to the repository. The preview stays private until its sharing or publishing settings are explicitly changed.
