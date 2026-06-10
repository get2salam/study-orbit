import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseBackup,
  MAX_BACKUP_BYTES,
  MAX_BACKUP_ITEMS,
  DANGEROUS_ITEM_KEYS,
} from '../js/backup.js';

const tag = (item) => ({ tag: 'safe', ...item });

test('parseBackup rejects non-string input', () => {
  assert.throws(() => parseBackup(null), /must be text/i);
  assert.throws(() => parseBackup({}), /must be text/i);
});

test('parseBackup rejects payloads above the byte cap before JSON.parse runs', () => {
  // Build oversized text without ever feeding it through JSON.parse ourselves.
  const oversized = 'x'.repeat(MAX_BACKUP_BYTES + 1);
  assert.throws(() => parseBackup(oversized), /too large/i);
});

test('parseBackup rejects non-JSON, non-object, and missing-items payloads', () => {
  assert.throws(() => parseBackup('not json'), /not valid JSON/i);
  assert.throws(() => parseBackup('[]'), /must be a JSON object/i);
  assert.throws(() => parseBackup('null'), /must be a JSON object/i);
  assert.throws(() => parseBackup('{}'), /missing an "items" array/i);
  assert.throws(() => parseBackup('{"items": "nope"}'), /missing an "items" array/i);
});

test('parseBackup caps oversized item arrays and reports the dropped count', () => {
  const items = Array.from({ length: MAX_BACKUP_ITEMS + 10 }, (_, i) => ({ title: `t${i}` }));
  const result = parseBackup(JSON.stringify({ items }), { normalizeItem: tag });
  assert.equal(result.items.length, MAX_BACKUP_ITEMS);
  assert.equal(result.dropped, 10);
  assert.equal(result.items[0].tag, 'safe');
});

test('parseBackup drops items carrying prototype-pollution keys', () => {
  for (const danger of DANGEROUS_ITEM_KEYS) {
    const raw = `{"items":[{"title":"ok"},{"title":"bad","${danger}":{"polluted":true}}]}`;
    const result = parseBackup(raw, { normalizeItem: tag });
    assert.equal(result.items.length, 1, `expected ${danger} item to be dropped`);
    assert.equal(result.items[0].title, 'ok');
    assert.equal(result.dropped, 1);
  }
  // Defense in depth: confirm Object.prototype was not polluted by the parse.
  assert.equal({}.polluted, undefined);
});

test('parseBackup drops items that are not plain objects', () => {
  const raw = JSON.stringify({ items: [{ title: 'keep' }, null, 42, 'string', ['array']] });
  const result = parseBackup(raw, { normalizeItem: tag });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, 'keep');
  assert.equal(result.dropped, 4);
});

test('parseBackup sanitizes boardTitle and boardSubtitle through the shared bounds', () => {
  const result = parseBackup(JSON.stringify({
    boardTitle: '   Trimmed board   ',
    boardSubtitle: 42,
    items: [],
  }), { normalizeItem: tag });
  assert.equal(result.boardTitle, 'Trimmed board');
  assert.ok(result.boardSubtitle.length > 0, 'non-string subtitle should fall back, not blank out');
});

test('parseBackup ignores ui when it is not a plain object or carries dangerous keys', () => {
  const arrayUi = parseBackup(JSON.stringify({ items: [], ui: [] }), { normalizeItem: tag });
  assert.deepEqual(arrayUi.ui, {});

  const pollutedUi = parseBackup('{"items":[],"ui":{"__proto__":{"x":1}}}', { normalizeItem: tag });
  assert.deepEqual(pollutedUi.ui, {});
  assert.equal({}.x, undefined);
});

test('parseBackup passes clean items through the normalize callback when provided', () => {
  const result = parseBackup(JSON.stringify({
    items: [{ title: 'one' }, { title: 'two' }],
  }), { normalizeItem: (item) => ({ ...item, normalized: true }) });
  assert.equal(result.items.length, 2);
  assert.ok(result.items.every((item) => item.normalized === true));
  assert.equal(result.dropped, 0);
});
