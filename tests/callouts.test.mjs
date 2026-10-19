import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import callouts from '../src/lib/markdown-callouts.mjs';

const processor = await createSatteriMarkdownProcessor({ hastPlugins: [callouts], syntaxHighlight: false });
const render = async markdown => new JSDOM((await processor.render(markdown)).code);

test('Markdown callouts preserve paragraphs, emphasis, lists, and links with labeled icons', async () => {
  const dom = await render(['INFO', 'WARNING', 'DANGER', 'NOTE', 'TIP'].map(kind =>
    `> [!${kind}]\n> First **bold** and *italic* paragraph.\n>\n> Second [linked](https://hunts.dev) paragraph.\n>\n> - One\n> - Two`).join('\n\n'));
  try {
    const blocks = dom.window.document.querySelectorAll('.callout');
    assert.equal(blocks.length, 5);
    for (const block of blocks) {
      assert.equal(block.getAttribute('role'), 'note');
      assert.equal(block.getAttribute('aria-label'), block.querySelector('.callout-title').textContent);
      assert.equal(block.querySelector('svg').getAttribute('aria-hidden'), 'true');
      assert.equal(block.querySelector('.callout-body strong').textContent, 'bold');
      assert.equal(block.querySelector('.callout-body em').textContent, 'italic');
      assert.equal(block.querySelector('.callout-body a').href, 'https://hunts.dev/');
      assert.equal(block.querySelectorAll('.callout-body p').length, 2);
      assert.equal(block.querySelectorAll('li').length, 2);
      assert.ok(!block.textContent.includes('[!'));
    }
    const icons = [...blocks].slice(0, 3).map(block => block.querySelector('svg').innerHTML);
    assert.equal(new Set(icons).size, 3);
  } finally { dom.window.close(); }
});

test('ordinary quotes, unknown markers, literal code, and quoted inline markers keep their content', async () => {
  const dom = await render('> An ordinary **quote**.\n\n> [!UNKNOWN]\n> Keep this.\n\n```md\n> [!DANGER]\n```\n\n> `[!INFO]` is literal code.');
  try {
    const document = dom.window.document;
    assert.equal(document.querySelectorAll('.callout').length, 0);
    assert.equal(document.querySelectorAll('blockquote').length, 3);
    assert.equal(document.querySelector('blockquote strong').textContent, 'quote');
    assert.ok(document.querySelector('pre code').textContent.includes('[!DANGER]'));
    assert.ok(document.body.textContent.includes('[!UNKNOWN]'));
  } finally { dom.window.close(); }
});

test('single-paragraph and empty callouts render without duplicating markers or text', async () => {
  const dom = await render('> [!info]\n> **Only once**.\n\n> [!WARNING]');
  try {
    const document = dom.window.document;
    assert.equal(document.querySelectorAll('.callout').length, 2);
    assert.equal(document.querySelectorAll('strong').length, 1);
    assert.equal(document.querySelectorAll('.callout-body p').length, 1);
    assert.ok(!document.body.textContent.includes('[!'));
  } finally { dom.window.close(); }
});
