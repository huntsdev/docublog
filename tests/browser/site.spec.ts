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
  await page.getByRole('button', { name: /theme|appearance/i }).click();
  await page.getByRole('menuitemradio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: /theme|appearance/i }).click();
  await page.getByRole('menuitemradio', { name: 'System' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('topic filtering and sort preserve the selected posts', async ({ page }) => {
  await page.goto('/blog/');
  await page.locator('.topic-button').filter({ hasText: /^PowerShell$/ }).click();
  await expect(page).toHaveURL(/tag=PowerShell/);
  const visible = page.locator('[data-post-wrapper]:visible');
  const total = await visible.count();
  expect(total).toBeGreaterThan(0);
  expect(total).toBeLessThan(5);
  for (const wrapper of await visible.all()) {
    expect(JSON.parse(await wrapper.locator('[data-post]').getAttribute('data-tags') || '[]')).toContain('PowerShell');
  }
  await page.getByLabel('Sort blog posts').selectOption('oldest');
  const dates = await visible.locator('[data-post]').evaluateAll(elements => elements.map(el => Number((el as HTMLElement).dataset.date)));
  expect(dates).toEqual([...dates].sort((a, b) => a - b));
  await page.reload();
  await expect(page.locator('.topic-button.selected')).toHaveText('PowerShell');
  await page.getByRole('button', { name: 'All posts', exact: true }).click();
  await expect(page.locator('[data-post-wrapper]:visible')).toHaveCount(5);
});

test('article rendering, assets, social URLs, and counters are present in the correct sections', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/blog/active-directory-enumeration/');
  await expect(page.locator('.prose pre code').first()).toBeVisible();
  await expect(page.locator('.table-scroll')).toHaveCount(1);
  await expect(page.locator('.outline-nav a').first()).toBeVisible();
  await expect(page.locator('.code-copy').first()).toHaveText('Copy');
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
