import { test, expect } from '@playwright/test';

test('search finds a project, a misspelled title, and words inside article content', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search all posts, projects, and pages' }).click();
  const input = page.getByRole('combobox', { name: 'Search the site' });
  await input.fill('Active Directory PowerShell Toolkit');
  const project = page.locator('.search-result').filter({ hasText: 'Projects > Active Directory PowerShell Toolkit' });
  await expect(project).toHaveCount(1);
  await input.fill('enumeraton');
  await expect(page.locator('.search-result').filter({ hasText: 'A practical guide to Active Directory enumeration' })).toBeVisible();
  await input.fill('Get-ADComputer');
  await expect(page.locator('.search-result').filter({ hasText: 'A practical guide to Active Directory enumeration' })).toBeVisible();
  await input.fill('zqxywvv123456');
  await expect(page.getByText('No results found')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Search all posts, projects, and pages' })).toBeFocused();
});

test('theme choices persist across reloads and react to the system preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('astro-island[component-url*="ThemeToggle"]')).not.toHaveAttribute('ssr', '');
  await page.getByRole('button', { name: /theme|appearance/i }).click();
  await page.getByRole('menuitemradio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('astro-island[component-url*="ThemeToggle"]')).not.toHaveAttribute('ssr', '');
  await page.getByRole('button', { name: /theme|appearance/i }).click();
  await page.getByRole('menuitemradio', { name: 'System' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('topic filtering and sort preserve the selected posts', async ({ page }) => {
  await page.goto('/blog/');
  const allPosts = await page.locator('[data-post-wrapper]:visible').count();
  await page.locator('.topic-button').filter({ hasText: /^PowerShell$/ }).click();
  await expect(page).toHaveURL(/tag=PowerShell/);
  const visible = page.locator('[data-post-wrapper]:visible');
  const total = await visible.count();
  expect(total).toBeGreaterThan(0);
  expect(total).toBeLessThan(allPosts);
  for (const wrapper of await visible.all()) {
    expect(JSON.parse(await wrapper.locator('[data-post]').getAttribute('data-tags') || '[]')).toContain('PowerShell');
  }
  await page.getByLabel('Sort blog posts').selectOption('oldest');
  const dates = await visible.locator('[data-post]').evaluateAll(elements => elements.map(el => Number((el as HTMLElement).dataset.date)));
  expect(dates).toEqual([...dates].sort((a, b) => a - b));
  await page.reload();
  await expect(page.locator('.topic-button.selected')).toHaveText('PowerShell');
  await page.getByRole('button', { name: 'All posts', exact: true }).click();
  await expect(page.locator('[data-post-wrapper]:visible')).toHaveCount(allPosts);
});

test('article rendering, assets, social URLs, and counters are present in the correct sections', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/blog/active-directory-enumeration/');
  await expect(page.locator('.prose pre code').first()).toBeVisible();
  await expect(page.locator('.table-scroll')).toHaveCount(1);
  await expect(page.locator('.outline-nav a').first()).toBeVisible();
  await expect(page.locator('.code-toolbar').getByRole('button', { name: 'Copy code' }).first()).toBeVisible();
  await expect(page.locator('[data-track-view="true"] [data-view-count]')).toHaveText(/\d[\d,]* views?/);
  await page.goto('/projects/active-directory-powershell-toolkit/');
  await expect(page.locator('[data-view-slug]')).toHaveCount(0);
  await expect(page.locator('.sidebar a[href="https://github.com/huntsdev"]')).toHaveCount(1);
  await expect(page.locator('.sidebar a[href="https://x.com/huntsdevv"]')).toHaveCount(1);
  await expect(page.locator('.sidebar a[href="https://linkedin.com/in/ryananthunt"]')).toHaveCount(1);
  for (const asset of ['/favicon.ico', '/favicon-32x32.png', '/apple-touch-icon.png', '/site.webmanifest', '/rss.xml', '/search-index.json']) {
    expect((await request.get(asset)).status(), asset).toBe(200);
  }
  expect(errors).toEqual([]);
});

test('mobile navigation is usable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const control of ['Open navigation', 'Search all posts, projects, and pages', /theme|appearance/i]) {
    const bounds = await page.getByRole('button', { name: control }).boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  }
  await expect(page.locator('.sidebar')).toHaveAttribute('inert', '');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.sidebar')).not.toHaveAttribute('inert', '');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.locator('.sidebar').getByRole('link', { name: 'All projects', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/$/);
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflows).toBe(false);
});

test('code header labels and Animate UI copy feedback work in both themes', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/blog/powershell-patterns/');
  const block = page.locator('.code-block').first();
  const button = block.getByRole('button', { name: 'Copy code' });
  await expect(block.locator('.code-language')).toHaveText('PowerShell');
  await expect(block.locator('pre button')).toHaveCount(0);
  const content = await block.locator('pre code').textContent();
  await button.click();
  await expect(block.locator('[data-slot="copy-button"]')).toHaveAttribute('data-state', 'copied');
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(content);
  await expect(block.getByRole('button', { name: 'Copy code' })).toBeVisible({ timeout: 5000 });

  await page.getByRole('button', { name: /theme|appearance/i }).click();
  await page.getByRole('menuitemradio', { name: 'Dark' }).click();
  await block.getByRole('button', { name: 'Copy code' }).click();
  await expect(block.locator('[data-slot="copy-button"]')).toHaveAttribute('data-state', 'copied');
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(content);
});

test('copy button reports denied clipboard access and remains usable with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/blog/powershell-patterns/');
  const block = page.locator('.code-block').first();
  await expect(block.getByRole('button', { name: 'Copy code' })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
    });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });
  });
  await block.getByRole('button', { name: 'Copy code' }).click();
  await expect(block.locator('[data-slot="copy-button"]')).toHaveAttribute('data-state', 'error');
  await expect(block.getByRole('status')).toContainText(/couldn.t|failed|unable/i);
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await block.locator('[data-slot="copy-button"]').boundingBox();
  expect(bounds!.width).toBeGreaterThanOrEqual(32);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
});
