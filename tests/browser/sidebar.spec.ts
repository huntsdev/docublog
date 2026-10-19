import { test, expect, type Page } from '@playwright/test';

const sidebarWidth = (page: Page) => page.locator('.sidebar').evaluate(element => Math.round(element.getBoundingClientRect().width));
async function settleLayout(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
      .map(animation => animation.finished.catch(() => {})));
  });
}

test.beforeEach(async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.route('**/*', async route => {
    if (route.request().resourceType() === 'image' && new URL(route.request().url()).origin !== new URL(baseURL!).origin) await route.abort();
    else await route.continue();
  });
});

test('desktop sidebar collapses to named icons and persists across navigation and reload', async ({ page }) => {
  await page.goto('/');
  const toggle = page.locator('[data-toggle-sidebar]');
  await expect(toggle).toHaveAccessibleName('Collapse sidebar');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-sidebar-collapsed', 'true');
  await expect(toggle).toHaveAccessibleName('Expand sidebar');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(() => sidebarWidth(page)).toBe(72);
  await expect(page.locator('.header-brand-label')).toBeHidden();
  await expect(page.locator('.header-brand img')).toBeVisible();
  for (const name of ['Overview', 'About']) {
    const link = page.locator('.sidebar').getByRole('link', { name, exact: true });
    await expect(link).toBeVisible();
    await expect(link.locator('svg').first()).toBeVisible();
  }
  await expect(page.locator('.sidebar .sidebar-label:visible')).toHaveCount(0);
  for (const content of await page.locator('.nav-section-content').all()) await expect(content).toHaveAttribute('inert', '');
  expect(await page.evaluate(() => localStorage.getItem('hunts-sidebar-collapsed'))).toBe('true');
  await page.locator('.sidebar').getByRole('link', { name: 'About', exact: true }).click();
  await expect(page).toHaveURL(/\/about\/$/);
  await page.reload();
  await expect.poll(() => sidebarWidth(page)).toBe(72);
  await page.locator('[data-toggle-sidebar]').click();
  await expect(page.locator('html')).toHaveAttribute('data-sidebar-collapsed', 'false');
  await expect(page.locator('.header-brand-label')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('hunts-sidebar-collapsed'))).toBe('false');
});

test('navigation groups persist independently and a rail category reopens its contents', async ({ page }) => {
  await page.goto('/');
  const blog = page.locator('[data-sidebar-section="blog"]');
  const projects = page.locator('[data-sidebar-section="projects"]');
  for (const section of [blog, projects]) {
    await expect(section).toHaveAttribute('open', '');
    await section.locator('summary').click();
    await expect(section).not.toHaveAttribute('open', '');
    await expect(section.locator('.nav-section-content')).toHaveAttribute('inert', '');
  }
  await page.reload();
  for (const section of [blog, projects]) await expect(section).not.toHaveAttribute('open', '');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hunts-sidebar-sections')!))).toMatchObject({ blog: false, projects: false });
  await page.locator('[data-toggle-sidebar]').click();
  await expect.poll(() => sidebarWidth(page)).toBe(72);
  await expect(blog.locator('summary')).toHaveAccessibleName('Blog Posts');
  await expect(blog.locator('summary svg').first()).toBeVisible();
  await blog.locator('summary').click();
  await expect(page.locator('html')).toHaveAttribute('data-sidebar-collapsed', 'false');
  await expect(blog).toHaveAttribute('open', '');
  await expect(blog.locator('.nav-section-content')).not.toHaveAttribute('inert', '');
  await expect(blog.getByRole('link', { name: 'All posts', exact: true })).toBeVisible();
  await expect(projects).not.toHaveAttribute('open', '');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('hunts-sidebar-sections')!))).toMatchObject({ blog: true, projects: false });
});

test('article layout uses the available space and stays centered at desktop and tablet widths', async ({ page }) => {
  await page.goto('/blog/tailscale/', { waitUntil: 'domcontentloaded' });
  for (const width of [1280, 1920, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    await settleLayout(page);
    const expanded = await page.locator('.page-content').evaluate(element => element.getBoundingClientRect().width);
    await page.locator('[data-toggle-sidebar]').click();
    await expect.poll(() => sidebarWidth(page)).toBe(72);
    await settleLayout(page);
    const layout = await page.evaluate(() => {
      const main = document.querySelector('.main-shell')!.getBoundingClientRect();
      const sidebar = document.querySelector('.sidebar')!.getBoundingClientRect();
      return { leftGap: main.left - sidebar.right, rightGap: innerWidth - main.right,
        article: document.querySelector('.page-content')!.getBoundingClientRect().width,
        overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(Math.abs(layout.leftGap - layout.rightGap)).toBeLessThanOrEqual(1);
    expect(layout.overflow).toBe(false);
    expect(layout.article).toBeGreaterThanOrEqual(expanded);
    if (width <= 1280) expect(layout.article - expanded).toBeGreaterThan(20);
    await expect(page.locator('.article-header')).toBeVisible();
    await page.locator('[data-toggle-sidebar]').click();
    await settleLayout(page);
  }
});

test('mobile uses the full drawer and preserves the saved desktop preference', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-toggle-sidebar]').click();
  await expect.poll(() => sidebarWidth(page)).toBe(72);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-toggle-sidebar]')).toBeHidden();
  await expect(page.locator('.sidebar')).toHaveAttribute('inert', '');
  const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
  await menu.click();
  await expect(page.locator('.sidebar')).not.toHaveAttribute('inert', '');
  await expect.poll(() => sidebarWidth(page)).toBeGreaterThan(220);
  await expect(page.locator('.sidebar').getByRole('link', { name: 'All posts', exact: true })).toBeVisible();
  const close = page.locator('.sidebar').getByRole('button', { name: 'Close navigation', exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.sidebar a[href="/rss.xml"]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(page.locator('.sidebar')).toHaveAttribute('inert', '');
  expect(await page.evaluate(() => localStorage.getItem('hunts-sidebar-collapsed'))).toBe('true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await expect.poll(() => sidebarWidth(page)).toBe(72);
  await expect(page.locator('[data-toggle-sidebar]')).toBeVisible();
  await expect(page.locator('.sidebar')).not.toHaveAttribute('inert', '');
});

test('sidebar and group toggles support the keyboard with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const toggle = page.locator('[data-toggle-sidebar]');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => sidebarWidth(page)).toBe(72);
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const blog = page.locator('[data-sidebar-section="blog"]');
  await blog.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(blog).not.toHaveAttribute('open', '');
  await page.keyboard.press('Enter');
  await expect(blog).toHaveAttribute('open', '');
  const motion = await page.locator('.sidebar').evaluate(element => ({
    duration: Math.max(...getComputedStyle(element).transitionDuration.split(',').map(value => parseFloat(value))),
    running: element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length,
  }));
  expect(motion.duration).toBeLessThan(0.01);
  expect(motion.running).toBe(0);
});
