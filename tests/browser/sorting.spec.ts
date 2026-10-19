import { test, expect } from '@playwright/test';
import { JSDOM } from 'jsdom';

test('most viewed waits for counts, then keeps sorting and topic filters in the URL', async ({ page }) => {
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/views/?*', async route => {
    await ready;
    const slugs = new URL(route.request().url()).searchParams.get('slugs')!.split(',');
    await route.fulfill({ json: { views: Object.fromEntries(slugs.map(slug => [slug, slug === 'previous' ? 900 : 0])) } });
  });
  await page.goto('/blog/?sort=views');
  const sort = page.getByLabel('Sort blog posts');
  await expect(sort).toHaveValue('views');
  await expect(page.locator('[data-sort-status]')).toHaveText('Loading view counts…');
  release();
  const items = page.locator('[data-post-wrapper]:visible');
  await expect(items.first().locator('[data-view-slug]')).toHaveAttribute('data-view-slug', 'previous');
  await expect(page.locator('[data-sort-status]')).toBeHidden();
  await sort.selectOption('oldest');
  await expect(page).toHaveURL(/sort=oldest/);
  const dates = await items.evaluateAll(items => items.map(item => Number((item as HTMLElement).dataset.date)));
  expect(dates).toEqual([...dates].sort((a, b) => a - b));
  await page.locator('[data-topic-toggle]').click();
  await page.locator('.topic-button').filter({ hasText: /^Homelab$/ }).click();
  await expect(page).toHaveURL(/tag=Homelab.*sort=oldest/);
  await page.reload();
  await expect(sort).toHaveValue('oldest');
  await expect(page.locator('.topic-button.selected')).toHaveText('Homelab');
  await sort.selectOption('title');
  const titles = await items.evaluateAll(items => items.map(item => (item as HTMLElement).dataset.title!));
  expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true })));
});

test('unavailable counts explain the newest-first fallback without inventing zeroes', async ({ page }) => {
  await page.route('**/api/views/?*', route => route.fulfill({ status: 503, json: { error: 'Unavailable' } }));
  await page.goto('/blog/?sort=views');
  await expect(page.locator('[data-sort-status]')).toHaveText('View counts are unavailable. Showing newest first.');
  const items = page.locator('[data-post-wrapper]');
  const dates = await items.evaluateAll(items => items.map(item => Number((item as HTMLElement).dataset.date)));
  expect(dates).toEqual([...dates].sort((a, b) => b - a));
  await expect(page.locator('[data-view-slug][data-views]')).toHaveCount(0);
});

test('project controls support empty listings, dates, views, featured, status, and title order', async ({ page }) => {
  await page.goto('/projects/?sort=status');
  const sort = page.getByLabel('Sort projects');
  await expect(sort).toHaveValue('status');
  await expect(sort.locator('option')).toHaveCount(6);
  // Use controlled card metadata to exercise all project sorts even in an empty workspace.
  // The response keeps the actual page's scripts, styling, and sort control.
  await page.route('**/projects/**', async route => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    const html = await response.text();
    const cards = [
      { title: 'Zulu', date: '200', views: '0', status: 'Archived', featured: 'false' },
      { title: 'Beta', date: '100', views: '7', status: 'In progress', featured: 'true' },
      { title: 'Alpha', date: '', views: '9', status: 'Active', featured: 'false' },
    ].map(item => `<a class="project-card" data-listing-item data-title="${item.title}" data-date="${item.date}" data-featured="${item.featured}" data-status="${item.status}"><h3>${item.title}</h3><span data-view-slug="test-${item.title.toLowerCase()}" data-view-collection="projects" data-view-state="ready" data-views="${item.views}"></span></a>`).join('');
    const document = new JSDOM(html);
    document.window.document.querySelector('[data-list]')!.innerHTML = cards;
    document.window.document.querySelector('.list-empty')?.remove();
    await route.fulfill({ response, body: document.serialize() });
    document.window.close();
  });
  await page.goto('/projects/');
  const titles = () => page.locator('[data-listing-item]').evaluateAll(items => items.map(item => (item as HTMLElement).dataset.title));
  for (const [order, expected] of [
    ['newest', ['Zulu', 'Beta', 'Alpha']],
    ['oldest', ['Beta', 'Zulu', 'Alpha']],
    ['views', ['Alpha', 'Beta', 'Zulu']],
    ['title', ['Alpha', 'Beta', 'Zulu']],
    ['featured', ['Beta', 'Zulu', 'Alpha']],
    ['status', ['Alpha', 'Beta', 'Zulu']],
  ] as const) {
    await sort.selectOption(order);
    expect(await titles()).toEqual([...expected]);
  }
  await expect(page).toHaveURL(/sort=status/);
  await page.reload();
  await expect(sort).toHaveValue('status');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
