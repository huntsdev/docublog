# hunts.dev

A Markdown-first personal blog with the navigation and reading experience of a documentation site. Built with Astro, React, accessible Radix components, MiniSearch, and Upstash Redis for durable blog view counts. Astro's Vercel adapter deploys the view API alongside the static articles.

The included articles, projects, and biography are illustrative starter content. Replace them with your own writing and verify your social links before a public launch.

## Features

- Responsive documentation layout, collapsible navigation, article table of contents, and mobile menu.
- Smooth sidebar collapse to an icon rail, with saved sidebar and section preferences.
- Markdown blog posts, projects, and About page; optional MDX for callouts, link cards, and embedded media.
- Blog topic tags, tag archives, reading time, and blog/project view counts.
- Sort posts and projects by newest, oldest, most viewed, or title; projects also support featured-first and status order.
- Full-text search with fuzzy and prefix matching, section filters, directory breadcrumbs, and keyboard navigation. Open with `Ctrl/Cmd + K` or `/`.
- Light, dark, and system appearance settings, persisted in the browser.
- Syntax-highlighted code, tables, task lists, quotes, and copyable code blocks.
- PDF exports with article formatting, your profile image, and a hunts.dev source link.
- RSS, canonical URLs, sitemap, and the supplied hunts.dev logo and favicon assets.

## Run locally

Use Node.js **22.13.0 or newer**. Run commands from the project root.

```sh
npm install
npm run dev
```

`npm run dev` runs the site and the Upstash-backed view API. Copy `.env.example` to `.env`, fill in your Upstash REST URL and token, and restart the server to enable counts. Without credentials or when Redis is unavailable, counts display an em dash (`—`). No database migrations or Cloudflare account are required.

`npm run preview` opens another Astro development server on port 4322 for local review and browser checks. It serves the current source, including the API, rather than the built Vercel output. The Vercel adapter does not support `astro preview`; use Vercel to run its production build artifacts.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Astro content and UI development server |
| `npm run build` | Generate static pages, PDFs, search index, and Vercel API deployment artifacts |
| `npm run build:vercel` | Alias for the Vercel-compatible Astro build |
| `npm run preview` | Run the site and Upstash API from source at port 4322 |
| `npm run check` | Check Astro and TypeScript files |
| `npm test` | Run view-count API and Markdown callout tests |
| `npm run test:e2e` | Run browser checks against a preview at port 4322 |

For browser checks, start `npm run preview` first. Install Chromium with `npx playwright install chromium` if it is not already available. Set `PLAYWRIGHT_BASE_URL` to test a different preview URL.

## Write content

Content schemas live in `src/content.config.ts`. Use lowercase, hyphenated filenames for blog posts and projects: the filename becomes the URL slug. Blog posts must use a flat filename such as `my-first-post.md`.

Projects may include `date: 2026-10-18` in their frontmatter for chronological sorting. Undated projects appear last when sorting by date. The listing sort is saved in the URL (`?sort=views`, for example) and works with blog topic filters. Most-viewed order updates when counts finish loading; unavailable counts stay below known counts, with newest-first order as a fallback.

### Blog posts

Create `src/content/blog/my-first-post.md`:

```md
---
title: "My first field note"
author: "Ryan Hunt"
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

An optional `image` accepts a root-relative image path or HTTP(S) URL. It appears as a compact article thumbnail and supplies the social sharing image. Publication dates and tags are also included in article sharing metadata.

Blog posts, projects, and About content accept `author`, which defaults to `Ryan Hunt`. That exact name displays Ryan’s portrait in article and listing bylines; other names display as text. Author profiles are configured in `src/lib/authors.ts`, with portrait assets in `public/images/`. Author names are also searchable and included in page and RSS metadata.

### Projects

Create `src/content/projects/my-project.md`:

```md
---
title: "Active Directory PowerShell Toolkit"
author: "Ryan Hunt"
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

Markdown posts support colored callouts with icons, including in PDF exports:

```md
> [!INFO]
> Helpful context with **bold** and *italic* text.

> [!WARNING]
> Something that needs extra care.

> [!DANGER]
> A critical risk or destructive action.
```

Keep the marker on its own first line and prefix every line inside the block with `>`. Use `>` on a blank line to separate paragraphs within a callout. `INFO` is blue, `WARNING` is amber, and `DANGER` is red, with distinct icons in light and dark mode. `NOTE` and `TIP` are also supported. Ordinary blockquotes keep their usual styling.

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

`Callout` supports `info`, `warning`, and `danger`, plus the existing `note` and `tip` variants. For example, `<Callout variant="danger" title="Before you continue">...</Callout>`. `LinkCard` accepts a root-relative internal URL or an HTTPS external URL. `Embed` requires an HTTPS embed URL and an accessible title; supported providers are YouTube, Vimeo, CodePen, and Spotify. Use the provider's embed URL rather than its regular watch or share URL. Unsupported URLs fail the build with a descriptive error.

Put images and other downloadable assets in `public/` and reference them with root-relative paths, such as `![Diagram description](/images/diagram.png)`.

Markdown images open in a dimmed image viewer when clicked. Click the image or backdrop, use the close button, or press Escape to return to the article. Images linked to other pages keep their normal navigation behavior.

Each published blog post has an **Export PDF** link that downloads `/blog/<slug>.pdf` directly. Astro generates these files from the post's rendered Markdown during each build, so they use the same content as the blog and work on static hosting. The PDF contains the title and formatted post content, with selectable text, embedded images, tables, and syntax-highlighted code. It excludes the site's navigation and other interface elements. A small footer includes Ryan's profile image and the original `https://hunts.dev/blog/<slug>/` URL.

PDF images are read from `public/` or fetched from their original URLs during generation. If a remote image is unavailable, the build logs a warning and the PDF includes its description and source link. Rebuild after editing a post to update its downloadable PDF; the development server regenerates PDFs on request.

## Search and personalization

The build automatically generates `/search-index.json` from published content. Search covers titles, descriptions, full article and project text, section names, and blog tags. Results show the content directory, for example `Projects > Active Directory PowerShell Toolkit`. MiniSearch loads only when the search dialog first opens; no external search service is required.

Update GitHub, X, and LinkedIn URLs in `src/lib/content.ts`. The supplied logo and favicon files live in `public/`; `site.webmanifest` supplies the app icon metadata. Shared layout and styles live in `src/layouts/` and `src/styles/`.

Use the button beside **Navigation** to collapse the desktop sidebar to icons or expand it again. Blog Posts and Projects expand independently, and selecting a section icon in the compact sidebar reopens it. Sidebar width and section preferences are saved in the browser. On mobile, the navigation opens as a full drawer. Transitions respect the system's reduced-motion preference.

## What a view means

Blog and project views are stored durably in Upstash Redis and start at zero. A visit increments the count only when the individual article or project is visible. A browser cookie prevents repeated increments for the same item within 30 minutes. Counts are aggregate pageviews, not a count of unique people. Archive pages and the About page never record views.

When the view API is unavailable, the interface shows `—` rather than an invented count. Redis increments are atomic, archive counts are read in batches, and only existing blog/project slugs are accepted. Tokens are read on the server with `astro:env/server`; no Redis credentials are sent to the browser.

The default Redis namespaces are `hunts:views:development`, `hunts:views:preview`, and `hunts:views:production`. Local browsing does not change live counts. Blog keys remain `<namespace>:post:<slug>`; project keys use `<namespace>:project:<slug>`, so matching slugs stay independent. Project API requests use `?collection=projects`; blog requests keep their existing URLs. Set `VIEW_COUNT_NAMESPACE` to override the default; use different values or separate databases for development and production. Existing D1 counts are not automatically imported into Redis.

## Set up Upstash views

1. Create a Redis database in the [Upstash console](https://console.upstash.com/), or add Upstash Redis through the Vercel Marketplace. Choose a region near your Vercel functions.
2. Copy its REST URL and read/write REST token into these environment variables:

   ```dotenv
   UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
   UPSTASH_REDIS_REST_TOKEN=your-read-write-rest-token
   ```

3. For local development, add those values to `.env` using `.env.example` as a template and restart `npm run dev`. For Vercel, add them to the project's Environment Variables for Production and Preview as needed, then redeploy. Use the standard `UPSTASH_REDIS_REST_*` names above even if your Marketplace installation provides `KV_*` aliases.
4. Visit a published article, then refresh it. The first visit counts; refreshes in the same browser within 30 minutes keep the same count. The archive displays those same stored counts.

The database does not need tables or migrations. Keep `.env` untracked and these variables server-only; do not use a `PUBLIC_` prefix. See the [Upstash Redis setup documentation](https://upstash.com/docs/redis/sdks/ts/getstarted).

## Canonical URL and deployment

The default canonical site URL is the private Sites preview URL, `https://hunts-dev.kindslug32.chatgpt.site`. Set `SITE_URL` when building for your own domain so canonical links, sitemap, and RSS use the correct origin.

PowerShell:

```powershell
$env:SITE_URL = 'https://hunts.dev'
npm run build
```

### Vercel

The checked-in `vercel.json` selects Astro and runs `npm run build:vercel`. The official `@astrojs/vercel` adapter emits `.vercel/output`, including static articles and PDFs plus a serverless function for `/api/views/` and `/api/views/<slug>/`. Leave Vercel's Output Directory override disabled so the adapter's Build Output API configuration controls routing.

In Vercel, set the Root Directory to the folder containing `package.json` and `vercel.json` (the repository root for this project). Set `SITE_URL` to your production origin, such as `https://hunts.dev`, and add the Upstash environment variables described above. Push the changes and redeploy. The view API and pages share the same origin; no external API URL or CORS configuration is needed.

The old Worker, Wrangler, Drizzle, and `.openai/hosting.json` files are retained for reference and existing Sites identity. They are not used by the current build or Vercel deployment. Existing local D1 data is left intact; the former Cloudflare deployment procedure is no longer the current build path.
