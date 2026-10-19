import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

const textKey = (value: string) => value.normalize('NFKC').replace(/\s+/g, '');

async function readPdf(bytes: Uint8Array) {
  const loading = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  const document = await loading.promise;
  try {
    const pages: string[] = [];
    const links: string[] = [];
    const images: { width: number; height: number }[] = [];
    const fonts = new Set<string>();
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => {
        if (!('str' in item)) return '';
        fonts.add(item.fontName);
        return item.str;
      }).join(' ').replace(/\s+\d+\s*\/\s*\d+\s*$/, ''));
      for (const annotation of await page.getAnnotations()) {
        if (annotation.url) links.push(annotation.url);
      }
      const operators = await page.getOperatorList();
      operators.fnArray.forEach((operator, index) => {
        if (operator === OPS.paintImageXObject) {
          const [, width, height] = operators.argsArray[index];
          images.push({ width, height });
        } else if (operator === OPS.paintInlineImageXObject) {
          const [{ width, height }] = operators.argsArray[index];
          images.push({ width, height });
        }
      });
    }
    const { info } = await document.getMetadata();
    const text = pages.join(' ');
    return { pages, text, key: textKey(text), links, images, fonts: [...fonts], info };
  } finally {
    await loading.destroy();
  }
}

async function articleText(page: Page) {
  return page.locator('.prose').evaluate(element => {
    const copy = element.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('.heading-anchor, .code-toolbar').forEach(control => control.remove());
    return [...copy.querySelectorAll('p, h2, h3, h4')].map(item => item.textContent?.trim() || '').filter(Boolean);
  });
}

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  // Browser checks use the generated PDFs, independently of remote image hosts.
  await page.route('**/*', async route => {
    if (route.request().resourceType() === 'image' && new URL(route.request().url()).origin !== origin) await route.abort();
    else await route.continue();
  });
});

test('Export PDF downloads a branded article file without opening print', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('pdf-test-print-calls', '0');
    window.print = () => {
      localStorage.setItem('pdf-test-print-calls', '1');
      throw new Error('PDF download must not open the print dialog');
    };
  });
  await page.goto('/blog/av-evasion/', { waitUntil: 'domcontentloaded' });
  const link = page.getByRole('link', { name: 'Export PDF', exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', '/blog/av-evasion.pdf');
  await expect(link).toHaveAttribute('download', 'av-evasion.pdf');
  const title = await page.locator('.article-header h1').innerText();
  const paragraphs = await articleText(page);
  const tags = await page.locator('.article-tags a').allTextContents();
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
  expect(download.suggestedFilename()).toBe('av-evasion.pdf');
  expect(await download.failure()).toBeNull();
  const pdf = await readPdf(await readFile((await download.path())!));
  expect(pdf.key).toContain(textKey(title));
  for (const paragraph of paragraphs) expect(pdf.key).toContain(textKey(paragraph));
  expect(pdf.key).toContain(textKey('https://hunts.dev/blog/av-evasion/'));
  expect(pdf.links).toContain('https://hunts.dev/blog/av-evasion/');
  expect(pdf.images.length).toBeGreaterThanOrEqual(1);
  expect(pdf.images.some(image => image.width === image.height && image.width > 0)).toBe(true);
  for (const label of ['On this page', 'Copy page link', 'Copy code', 'End of note', 'Built with curiosity', 'my personal knowledge base']) {
    expect(pdf.key).not.toContain(textKey(label));
  }
  for (const tag of tags.filter(tag => ![title, ...paragraphs].join(' ').includes(tag))) expect(pdf.key).not.toContain(textKey(tag));
  expect(pdf.text).not.toMatch(/\d+\s+min read/);
  expect(await page.evaluate(() => localStorage.getItem('pdf-test-print-calls'))).toBe('0');
});

test('direct PDF response has article metadata and stays identical across themes', async ({ page, request }) => {
  await page.goto('/blog/av-evasion/', { waitUntil: 'domcontentloaded' });
  const title = await page.locator('.article-header h1').innerText();
  const files: Uint8Array[] = [];
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => localStorage.setItem('hunts-theme', value), theme);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator('[data-export-pdf]')).toHaveAttribute('href', '/blog/av-evasion.pdf');
    const response = await request.get('/blog/av-evasion.pdf');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^application\/pdf\b/);
    const bytes = await response.body();
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    files.push(bytes);
  }
  expect(files[1]).toEqual(files[0]);
  const pdf = await readPdf(files[0]);
  expect(pdf.info).toMatchObject({ Title: title, Author: 'Ryan Hunt' });
  expect(pdf.links).toContain('https://hunts.dev/blog/av-evasion/');
});

test('PDF embeds local article screenshots alongside the profile image', async ({ request }) => {
  const response = await request.get('/blog/homelab.pdf');
  expect(response.ok()).toBe(true);
  const pdf = await readPdf(await response.body());
  expect(pdf.images.length).toBeGreaterThanOrEqual(2);
  expect(pdf.images.some(image => image.width === image.height && image.width > 0)).toBe(true);
  expect(pdf.images.some(image => image.width > image.height)).toBe(true);
});

for (const slug of ['previous', 'secretpictures']) {
  test(`${slug} PDF preserves selectable prose, code, and ending content across pages`, async ({ page, request }) => {
    await page.goto(`/blog/${slug}/`, { waitUntil: 'domcontentloaded' });
    const paragraphs = await articleText(page);
    const response = await request.get(`/blog/${slug}.pdf`);
    expect(response.ok()).toBe(true);
    const pdf = await readPdf(await response.body());
    expect(pdf.pages.length).toBeGreaterThan(1);
    for (const paragraph of paragraphs) expect(pdf.key, paragraph.slice(0, 90)).toContain(textKey(paragraph));
    expect(pdf.key).toContain(textKey(paragraphs.at(-1)!));
    expect(pdf.links).toContain(`https://hunts.dev/blog/${slug}/`);
    expect(pdf.fonts.length).toBeGreaterThan(1);
    const code = slug === 'previous' ? 'export TF_CLI_CONFIG_FILE=/tmp/previous.rc' : 'md5sum secretPictures.exe';
    expect(pdf.key).toContain(textKey(code));
    if (slug === 'previous') expect(pdf.key).toContain(textKey('bash-5.1# cat root.txt'));
    else {
      const cells = await page.locator('.prose th, .prose td').allTextContents();
      for (const cell of cells) expect(pdf.key).toContain(textKey(cell));
      expect(pdf.text).toContain('⭐');
    }
    for (const label of ['Copy code', 'Copy page link', 'End of note']) expect(pdf.key).not.toContain(textKey(label));
  });
}

test('PDF export links appear only on blog posts', async ({ page }) => {
  for (const path of ['/blog/', '/projects/']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-export-pdf]')).toHaveCount(0);
  }
});
