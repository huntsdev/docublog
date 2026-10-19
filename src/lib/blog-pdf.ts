import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { JSDOM } from 'jsdom';
import htmlToPdfmake from 'html-to-pdfmake';
import pdfmake from 'pdfmake';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import sharp from 'sharp';
import { calloutIcon, calloutVariants } from './callouts.mjs';

const require = createRequire(import.meta.url);
const root = process.cwd();
const publicRoot = resolve(root, 'public');
const contentWidth = 499.28; // A4 minus the two 48pt margins.
const maximumImageBytes = 12 * 1024 * 1024;
const images = new Map<string, Promise<string | undefined>>();
let activeImages = 0;
const imageQueue: (() => void)[] = [];

const mono = resolve(root, 'src/assets/pdf/JetBrainsMono-Regular.ttf');
const symbols = resolve(root, 'src/assets/pdf/NotoSansSymbols2-Regular.ttf');
const emoji = resolve(root, 'src/assets/pdf/NotoEmoji.ttf');
const prompt = resolve(root, 'src/assets/pdf/PromptSymbols.ttf');
const fonts = {
  Roboto: {
    normal: require.resolve('pdfmake/build/fonts/Roboto/Roboto-Regular.ttf'),
    bold: require.resolve('pdfmake/build/fonts/Roboto/Roboto-Medium.ttf'),
    italics: require.resolve('pdfmake/build/fonts/Roboto/Roboto-Italic.ttf'),
    bolditalics: require.resolve('pdfmake/build/fonts/Roboto/Roboto-MediumItalic.ttf'),
  },
  Mono: { normal: mono, bold: mono, italics: mono, bolditalics: mono },
  Symbols: { normal: symbols, bold: symbols, italics: symbols, bolditalics: symbols },
  Emoji: { normal: emoji, bold: emoji, italics: emoji, bolditalics: emoji },
  Prompt: { normal: prompt, bold: prompt, italics: prompt, bolditalics: prompt },
};
pdfmake.addFonts(fonts);
const fontkit = require('fontkit') as { openSync(path: string): { hasGlyphForCodePoint(code: number): boolean } };
const coverage = Object.fromEntries(Object.entries(fonts).map(([name, font]) => [name, fontkit.openSync(font.normal)]));
// Fontkit accepts feature flags; disabling contextual substitutions keeps copied code exact.
const codeFeatures = { liga: false, clig: false, calt: false };

// Select a real glyph for each Unicode character while retaining searchable text.
function fallbackFonts(value: unknown, inherited = 'Roboto', missing = new Set<string>()) {
  if (Array.isArray(value)) value.forEach(child => fallbackFonts(child, inherited, missing));
  else if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>;
    const primary = typeof node.font === 'string' ? node.font : inherited;
    if (primary === 'Mono') node.fontFeatures = codeFeatures;
    const plainText = typeof node.text === 'string';
    if (plainText) {
      const runs: { text: string; font: string; wordBreak?: 'normal'; fontFeatures?: typeof codeFeatures }[] = [];
      for (const character of node.text as string) {
        const point = character.codePointAt(0)!;
        const candidates = [primary, ...Object.keys(fonts).filter(name => name !== primary)];
        const invisible = /[\u200b-\u200f\ufe0e\ufe0f]/u.test(character);
        const font = invisible ? runs.at(-1)?.font ?? primary : /\s/u.test(character) ? primary
          : candidates.find(name => coverage[name]?.hasGlyphForCodePoint(point));
        if (!font) missing.add(`${character} (U+${point.toString(16).toUpperCase()})`);
        const chosen = font ?? primary;
        // pdfmake's break-all splits UTF-16 surrogates; let Unicode line breaking handle emoji.
        const wordBreak = point > 0xffff ? 'normal' : invisible ? runs.at(-1)?.wordBreak : undefined;
        if (runs.at(-1)?.font === chosen && runs.at(-1)?.wordBreak === wordBreak) runs.at(-1)!.text += character;
        else runs.push({ text: character, font: chosen, ...(wordBreak ? { wordBreak } : {}), ...(chosen === 'Mono' ? { fontFeatures: codeFeatures } : {}) });
      }
      if (runs.some(run => run.font !== primary || run.wordBreak)) node.text = runs;
    }
    Object.entries(node).forEach(([key, child]) => {
      if (key !== 'fontFeatures' && !(key === 'text' && plainText) && child && typeof child === 'object') fallbackFonts(child, primary, missing);
    });
  }
  return missing;
}
// Images are fetched and normalized here; the PDF library only reads our fonts.
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy(path => Object.values(fonts).some(font => Object.values(font).includes(path)));

async function imageSlot<T>(work: () => Promise<T>): Promise<T> {
  if (activeImages >= 6) await new Promise<void>(resume => imageQueue.push(resume));
  else activeImages++;
  try { return await work(); }
  finally {
    const next = imageQueue.shift();
    if (next) next();
    else activeImages--;
  }
}

async function imageBytes(source: string): Promise<Buffer> {
  if (source.startsWith('/') && !source.startsWith('//')) {
    const pathname = decodeURIComponent(new URL(source, 'https://hunts.dev').pathname);
    const file = resolve(publicRoot, '.' + pathname);
    const within = relative(publicRoot, file);
    if (!within || isAbsolute(within) || within === '..' || within.startsWith('..' + sep)) throw new Error('Invalid local image path');
    return readFile(file);
  }
  if (source.startsWith('data:image/')) {
    const match = /^data:image\/[\w.+-]+;base64,(.+)$/s.exec(source);
    if (!match) throw new Error('Unsupported image data');
    return Buffer.from(match[1], 'base64');
  }
  const url = new URL(source);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Unsupported image URL');
  const response = await fetch(url, { signal: AbortSignal.timeout(6_000) });
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > maximumImageBytes) {
    await response.body.cancel();
    throw new Error('Image is too large');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximumImageBytes) throw new Error('Image is too large');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks);
}

function loadImage(source: string): Promise<string | undefined> {
  let pending = images.get(source);
  if (!pending) {
    pending = imageSlot(async () => {
      try {
        const bytes = await imageBytes(source);
        if (bytes.length > maximumImageBytes) throw new Error('Image is too large');
        const png = await sharp(bytes, { limitInputPixels: 40_000_000 })
          .rotate().resize({ width: 1600, height: 2000, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
        return `data:image/png;base64,${png.toString('base64')}`;
      } catch (error) {
        console.warn(`[blog PDF] Could not embed ${source.slice(0, 180)}: ${error instanceof Error ? error.message : error}`);
        return undefined;
      }
    });
    images.set(source, pending);
  }
  return pending;
}

let avatar: Promise<string | undefined> | undefined;
function footerAvatar() {
  return avatar ??= (async () => {
    const image = await loadImage('/images/ryan-hunt-192.png');
    if (!image) return undefined;
    const round = await sharp(Buffer.from(image.split(',')[1], 'base64')).resize(96, 96)
      .composite([{ input: Buffer.from('<svg width="96" height="96"><circle cx="48" cy="48" r="48" fill="white"/></svg>'), blend: 'dest-in' }])
      .png().toBuffer();
    return `data:image/png;base64,${round.toString('base64')}`;
  })();
}

// The converter's customTag callback is supported at runtime but absent from its types.
interface PdfNode {
  nodeName?: string;
  table?: { body: Content[][]; widths?: string[]; headerRows?: number };
  [key: string]: unknown;
}

function customTag({ element, ret }: { element: HTMLElement; ret: PdfNode }): PdfNode {
  const tag = element.tagName;
  const callout = element.closest<HTMLElement>('.callout');
  const kind = callout?.dataset.variant;
  if (callout && kind && Object.prototype.hasOwnProperty.call(calloutVariants, kind)) {
    const variant = kind as keyof typeof calloutVariants;
    const { color, background } = calloutVariants[variant];
    if (element.classList.contains('callout-title')) {
      return {
        nodeName: 'DIV', margin: [0, 0, 0, 7], columnGap: 7,
        columns: [
          { svg: calloutIcon(variant, color), width: 14, height: 14 },
          { text: element.textContent?.trim() || calloutVariants[variant].label, fontSize: 10, bold: true, color, width: '*' },
        ],
      };
    }
    if (element === callout) {
      return {
        nodeName: 'TABLE', margin: [0, 8, 0, 12],
        table: { widths: ['*'], body: [[{ ...ret, fillColor: background, margin: 0 } as Content]] },
        layout: {
          hLineWidth: () => 0, vLineWidth: (index: number) => index === 0 ? 3 : 0, vLineColor: () => color,
          paddingLeft: () => 12, paddingRight: () => 12, paddingTop: () => 10, paddingBottom: () => 10,
        },
      };
    }
  }
  if (/^H[1-6]$/.test(tag)) ret.headlineLevel = Number(tag[1]);
  if (tag === 'IMG') {
    delete ret.width;
    delete ret.height;
    ret.fit = [Number(element.dataset.pdfWidth) || contentWidth, 620];
    ret.alignment = 'center';
    ret.margin = [0, 8, 0, 12];
  }
  if (tag === 'PRE') {
    return {
      nodeName: 'TABLE', margin: [0, 7, 0, 12],
      table: { widths: ['*'], body: [[{ ...ret, font: 'Mono', fontSize: 8, lineHeight: 1.35, margin: 0, fillColor: '#f4f5f7', preserveLeadingSpaces: true, wordBreak: 'break-all' } as Content]] },
      layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 10, paddingRight: () => 10, paddingTop: () => 8, paddingBottom: () => 8 },
    };
  }
  if (tag === 'BLOCKQUOTE') {
    return {
      nodeName: 'TABLE', margin: [0, 7, 0, 12],
      table: { widths: ['*'], body: [[{ ...ret, color: '#526070', margin: 0 } as Content]] },
      layout: { hLineWidth: () => 0, vLineWidth: (index: number) => index === 0 ? 2 : 0, vLineColor: () => '#9ba6b5', paddingLeft: () => 12, paddingRight: () => 5, paddingTop: () => 4, paddingBottom: () => 4 },
    };
  }
  if (tag === 'TABLE' && ret.table) {
    ret.table.widths = Array(ret.table.body[0]?.length ?? 1).fill('*');
    ret.table.headerRows = element.querySelector('thead')?.querySelectorAll('tr').length ?? (element.querySelector('tr th') ? 1 : 0);
    ret.fontSize = 8.5;
    ret.wordBreak = 'break-all';
    ret.margin = [0, 7, 0, 12];
    ret.layout = {
      hLineWidth: () => .5, vLineWidth: () => .5, hLineColor: () => '#d8dee6', vLineColor: () => '#d8dee6',
      paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 5, paddingBottom: () => 5,
    };
  }
  return ret;
}

async function prepareHtml(html: string, sourceUrl: string) {
  const dom = new JSDOM(html, { url: sourceUrl });
  const { document } = dom.window;
  document.querySelectorAll('script, style, link, meta, button, .heading-anchor, .code-toolbar, .code-copy-mount').forEach(node => node.remove());
  // The PDF title row draws the shared icon as a vector alongside its label.
  document.querySelectorAll('.callout .callout-icon').forEach(icon => icon.remove());
  document.querySelectorAll('iframe, video, audio, object, embed').forEach(media => {
    const target = media.getAttribute('src') || media.getAttribute('data') || media.querySelector('source')?.getAttribute('src');
    const paragraph = document.createElement('p');
    const label = media.getAttribute('title') || media.getAttribute('aria-label') || `View embedded ${media.tagName === 'IFRAME' ? 'content' : media.tagName.toLowerCase()}`;
    const link = document.createElement('a');
    link.textContent = label;
    if (target) { try { link.href = new URL(target, sourceUrl).href; } catch { /* Keep the authored label if malformed. */ } }
    paragraph.append(link);
    media.replaceWith(paragraph);
  });
  document.querySelectorAll<HTMLInputElement>('input').forEach(input => input.replaceWith(document.createTextNode(input.type === 'checkbox' ? (input.checked ? '[x] ' : '[ ] ') : '')));
  document.querySelectorAll('summary').forEach(summary => {
    const title = document.createElement('p');
    const bold = document.createElement('strong');
    bold.append(...summary.childNodes);
    title.append(bold);
    summary.replaceWith(title);
  });
  document.querySelectorAll('details').forEach(details => {
    const block = document.createElement('div');
    block.append(...details.childNodes);
    details.replaceWith(block);
  });
  document.querySelectorAll<HTMLElement>('pre').forEach(pre => pre.removeAttribute('style'));
  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(link => {
    const href = link.getAttribute('href')!;
    if (!href.startsWith('#')) {
      try { link.href = new URL(href, sourceUrl).href; } catch { link.removeAttribute('href'); }
    }
  });
  await Promise.all([...document.querySelectorAll<HTMLImageElement>('img')].map(async image => {
    const original = image.getAttribute('src') ?? '';
    let source = original;
    try {
      const url = new URL(original, sourceUrl);
      source = url.origin === 'https://hunts.dev' ? url.pathname + url.search : url.href;
    } catch { /* loadImage will report malformed authored image URLs. */ }
    const embedded = source && await loadImage(source);
    if (embedded) {
      image.src = embedded;
      const dimensions = await sharp(Buffer.from(embedded.split(',')[1], 'base64')).metadata();
      image.dataset.pdfWidth = String(Math.min(contentWidth, (dimensions.width ?? 666) * .75));
      image.removeAttribute('width');
      image.removeAttribute('height');
      image.removeAttribute('style');
    } else {
      const fallback = document.createElement('p');
      const label = document.createElement('em');
      label.textContent = `Image unavailable${image.alt ? `: ${image.alt}` : ''}. `;
      const link = document.createElement('a');
      try {
        const url = new URL(source || '/', sourceUrl);
        if (['https:', 'http:'].includes(url.protocol)) link.href = url.href;
      } catch { /* A malformed authored URL still gets a readable fallback. */ }
      link.textContent = source.startsWith('data:') ? 'Original image' : source;
      fallback.append(label, link);
      image.replaceWith(fallback);
    }
  }));
  return dom;
}

export async function createBlogPdf({ title, author, slug, html }: { title: string; author: string; slug: string; html: string }): Promise<Buffer> {
  const source = new URL(`/blog/${slug}/`, 'https://hunts.dev').href;
  const dom = await prepareHtml(html, source);
  try {
    const options: NonNullable<Parameters<typeof htmlToPdfmake>[1]> & { customTag: typeof customTag } = {
      window: dom.window, customTag,
      ignoreStyles: ['font-family'],
      // Code/tables use native character wrapping; prose keeps natural word breaks.
      replaceText: (text: string, parents: HTMLElement[]) => {
        const expanded = text.replace(/\t/g, '    ');
        return parents.some(parent => ['PRE', 'TD', 'TH'].includes(parent.tagName)) ? expanded : expanded.replace(/(\S{32})(?=\S)/g, '$1\u200b');
      },
      defaultStyles: {
        h1: { fontSize: 23, bold: true, margin: [0, 20, 0, 10] },
        h2: { fontSize: 18, bold: true, margin: [0, 18, 0, 8] },
        h3: { fontSize: 14, bold: true, margin: [0, 15, 0, 7] },
        h4: { fontSize: 12, bold: true, margin: [0, 12, 0, 6] },
        h5: { fontSize: 11, bold: true, margin: [0, 10, 0, 5] },
        h6: { fontSize: 10, bold: true, margin: [0, 10, 0, 5] },
        p: { margin: [0, 0, 0, 9] },
        a: { color: '#147083', decoration: 'underline' },
        code: { font: 'Mono', fontSize: 8.5 },
        ul: { margin: [12, 2, 0, 8] }, ol: { margin: [12, 2, 0, 8] },
        th: { bold: true, fillColor: '#eef1f5' },
      },
    };
    // The HTML bridge still declares pdfmake 0.2 types; its document nodes also work with 0.3.
    const content = htmlToPdfmake(dom.window.document.body.innerHTML, options) as unknown as Content;
    const portrait = await footerAvatar();
    const definition: TDocumentDefinitions = {
      pageSize: 'A4', pageMargins: [48, 48, 48, 52],
      info: { title, author, subject: `Originally published on hunts.dev: ${source}`, creator: 'hunts.dev' },
      defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.5, color: '#25303c' },
      content: [
        { text: title, fontSize: 25, bold: true, lineHeight: 1.15, margin: [0, 0, 0, 23], headlineLevel: 1 },
        content,
        {
          unbreakable: true, margin: [0, 24, 0, 0],
          table: { widths: portrait ? [31, '*'] : ['*'], body: [[
            ...(portrait ? [{ image: portrait, width: 26, height: 26 }] : []),
            { stack: [
              { text: 'hunts.dev', bold: true, fontSize: 10, link: 'https://hunts.dev/' },
              { text: 'Originally published on hunts.dev', fontSize: 8, color: '#647184' },
              { text: source, fontSize: 8, color: '#147083', link: source },
            ] },
          ]] },
          layout: { hLineWidth: index => index === 0 ? .6 : 0, vLineWidth: () => 0, hLineColor: () => '#d8dee6', paddingTop: () => 12, paddingLeft: () => 0, paddingRight: () => 0 },
        },
      ],
      footer: (page, count) => ({ text: `${page} / ${count}`, alignment: 'right', fontSize: 8, color: '#8a94a3', margin: [48, 18, 48, 0] }),
      pageBreakBefore: (node, container) => Boolean(node.headlineLevel && container.getFollowingNodesOnPage().length === 0),
    };
    const missing = fallbackFonts(definition.content);
    if (missing.size) console.warn(`[blog PDF] No embedded font contains: ${[...missing].join(', ')}`);
    return await pdfmake.createPdf(definition).getBuffer();
  } finally { dom.window.close(); }
}
