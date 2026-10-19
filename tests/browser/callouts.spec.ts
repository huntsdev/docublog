import { test, expect } from '@playwright/test';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createBlogPdf } from '../../src/lib/blog-pdf';
import callouts from '../../src/lib/markdown-callouts.mjs';
import { writeFile } from 'node:fs/promises';

const markdown = ['INFO', 'WARNING', 'DANGER'].map(kind =>
  `> [!${kind}]\n> Keep **bold**, *italic*, and [linked text](https://hunts.dev).\n>\n> - A list item\n> - A second item`).join('\n\n');

for (const theme of ['light', 'dark']) {
  test(`Markdown callout colors, icons, and formatting work in ${theme} mode`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('hunts-theme', value), theme);
    await page.goto('/blog/av-evasion/');
    await expect(page.locator('.prose .callout[data-variant="info"]')).toBeVisible();
    const processor = await createSatteriMarkdownProcessor({ hastPlugins: [callouts], syntaxHighlight: false });
    const { code } = await processor.render(markdown);
    await page.locator('.prose').evaluate((element, html) => { element.innerHTML = html; }, code);
    const colors: string[] = [];
    const icons: string[] = [];
    for (const variant of ['info', 'warning', 'danger']) {
      const block = page.locator(`.callout[data-variant="${variant}"]`);
      await expect(block).toBeVisible();
      await expect(block).toHaveAttribute('role', 'note');
      await expect(block.locator('.callout-title')).toHaveText(new RegExp(variant, 'i'));
      await expect(block.locator('svg')).toBeVisible();
      await expect(block.locator('svg')).toHaveAttribute('aria-hidden', 'true');
      await expect(block.locator('strong')).toHaveText('bold');
      expect(await block.locator('em').evaluate(element => getComputedStyle(element).fontStyle)).toBe('italic');
      await expect(block.locator('li')).toHaveCount(2);
      colors.push(await block.evaluate(element => getComputedStyle(element).borderLeftColor));
      icons.push(await block.locator('svg').innerHTML());
    }
    expect(new Set(colors).size).toBe(3);
    expect(new Set(icons).size).toBe(3);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}

test('PDF callouts retain content and their info, warning, and danger colors', async ({}, testInfo) => {
  const processor = await createSatteriMarkdownProcessor({ hastPlugins: [callouts], syntaxHighlight: false });
  const { code } = await processor.render(markdown);
  const bytes = await createBlogPdf({ title: 'Callout styles', author: 'Ryan Hunt', slug: 'callout-preview', html: code });
  await writeFile(testInfo.outputPath('callouts.pdf'), bytes);
  const loading = getDocument({ data: new Uint8Array(bytes) });
  const document = await loading.promise;
  try {
    let text = '';
    for (let number = 1; number <= document.numPages; number++) {
      const content = await (await document.getPage(number)).getTextContent();
      text += content.items.map(item => 'str' in item ? item.str : '').join(' ');
    }
    for (const label of ['Info', 'Warning', 'Danger', 'bold', 'italic', 'linked text', 'A second item', 'hunts.dev']) expect(text).toContain(label);
    expect(text).not.toContain('[!');
    const operators = await (await document.getPage(1)).getOperatorList();
    const strokes = operators.fnArray.flatMap((operator, index) => operator === OPS.setStrokeRGBColor ? operators.argsArray[index] : []);
    const fills = operators.fnArray.flatMap((operator, index) => operator === OPS.setFillRGBColor ? operators.argsArray[index] : []);
    for (const color of ['#1d4ed8', '#92400e', '#b91c1c']) expect(strokes).toContain(color);
    for (const color of ['#eff6ff', '#fffbeb', '#fef2f2']) expect(fills).toContain(color);
  } finally { await loading.destroy(); }
});
