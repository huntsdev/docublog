import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: ['src/lib/listing-sort.ts'], bundle: true, write: false, format: 'esm' });
const { compareListingItems } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const items = [
  { title: 'Zulu', date: 200, views: 0, status: 'Archived' },
  { title: 'Beta', date: 100, views: 7, featured: true, status: 'In progress' },
  { title: 'Alpha', views: 7, status: 'Active' },
  { title: 'Delta', date: 300, status: 'Active' },
];
const order = sort => [...items].sort((a, b) => compareListingItems(a, b, sort)).map(item => item.title);

test('date sorts keep undated projects last in both directions', () => {
  assert.deepEqual(order('newest'), ['Delta', 'Zulu', 'Beta', 'Alpha']);
  assert.deepEqual(order('oldest'), ['Beta', 'Zulu', 'Delta', 'Alpha']);
});

test('most viewed ranks real zeroes before unavailable counts with stable date tie breakers', () => {
  assert.deepEqual(order('views'), ['Beta', 'Alpha', 'Zulu', 'Delta']);
  const unavailable = items.map(({ views, ...item }) => item);
  assert.deepEqual(unavailable.sort((a, b) => compareListingItems(a, b, 'views')).map(item => item.title), order('newest'));
});

test('title, featured, and project status sorts are deterministic', () => {
  assert.deepEqual(order('title'), ['Alpha', 'Beta', 'Delta', 'Zulu']);
  assert.deepEqual(order('featured'), ['Beta', 'Delta', 'Zulu', 'Alpha']);
  assert.deepEqual(order('status'), ['Delta', 'Alpha', 'Beta', 'Zulu']);
});
