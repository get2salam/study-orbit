import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  clampNumber,
  sanitizeString,
  validIsoDate,
  daysFromToday,
  priority,
  ITEM_NUMBER_BOUNDS,
  ITEM_STRING_BOUNDS,
} from '../js/scoring.js';

// Use a local-time anchor so the suite is timezone-stable on any CI runner.
const FIXED_TODAY = new Date('2026-04-25T00:00:00');

const baseItem = Object.freeze({
  title: 'Past paper sprint',
  module: 'Exam drills',
  category: 'Practice',
  state: 'Planned',
  score: 7,
  effort: 4,
  confidence: 5,
  minutes: 90,
  reviews: 1,
  dueDate: '2026-04-25',
});

test('clampNumber rounds and clamps into bounds, falling back on garbage', () => {
  assert.equal(clampNumber(7.6, ITEM_NUMBER_BOUNDS.score), 8);
  assert.equal(clampNumber(-3, ITEM_NUMBER_BOUNDS.score), 1);
  assert.equal(clampNumber(999, ITEM_NUMBER_BOUNDS.score), 10);
  assert.equal(clampNumber('not a number', ITEM_NUMBER_BOUNDS.score), ITEM_NUMBER_BOUNDS.score.fallback);
  assert.equal(clampNumber(undefined, ITEM_NUMBER_BOUNDS.minutes), ITEM_NUMBER_BOUNDS.minutes.fallback);
});

test('sanitizeString trims, caps at maxLength, and falls back on non-strings', () => {
  assert.equal(sanitizeString('  hello  ', ITEM_STRING_BOUNDS.title), 'hello');
  assert.equal(sanitizeString('   ', ITEM_STRING_BOUNDS.title), ITEM_STRING_BOUNDS.title.fallback);
  assert.equal(sanitizeString(42, ITEM_STRING_BOUNDS.title), ITEM_STRING_BOUNDS.title.fallback);
  const long = 'x'.repeat(ITEM_STRING_BOUNDS.title.maxLength + 50);
  assert.equal(sanitizeString(long, ITEM_STRING_BOUNDS.title).length, ITEM_STRING_BOUNDS.title.maxLength);
});

test('validIsoDate accepts strict ISO and rejects anything else', () => {
  assert.equal(validIsoDate('2026-04-25', 'fallback'), '2026-04-25');
  assert.equal(validIsoDate('2026/04/25', 'fallback'), 'fallback');
  assert.equal(validIsoDate('25-04-2026', 'fallback'), 'fallback');
  assert.equal(validIsoDate(null, 'fallback'), 'fallback');
  assert.equal(validIsoDate('2026-13-40', 'fallback'), 'fallback');
});

test('daysFromToday uses an injectable today and handles missing values', () => {
  assert.equal(daysFromToday('2026-04-25', FIXED_TODAY), 0);
  assert.equal(daysFromToday('2026-04-28', FIXED_TODAY), 3);
  assert.equal(daysFromToday('2026-04-20', FIXED_TODAY), -5);
  assert.equal(daysFromToday('', FIXED_TODAY), 999);
});

test('daysFromToday falls back to 999 instead of NaN on unparseable due dates', () => {
  assert.equal(daysFromToday('not-a-date', FIXED_TODAY), 999);
  assert.equal(daysFromToday('2026-13-40', FIXED_TODAY), 999);
  assert.equal(daysFromToday('soon', FIXED_TODAY), 999);
});

test('priority stays finite when dueDate is malformed instead of collapsing to NaN', () => {
  const score = priority({ ...baseItem, dueDate: 'not-a-date' }, FIXED_TODAY);
  assert.ok(Number.isFinite(score), `priority should be finite, got ${score}`);
});

test('priority ranks soon-due sessions above far-due ones', () => {
  const dueToday = priority({ ...baseItem, dueDate: '2026-04-25' }, FIXED_TODAY);
  const dueLater = priority({ ...baseItem, dueDate: '2026-05-15' }, FIXED_TODAY);
  assert.ok(dueToday > dueLater, `due-today (${dueToday}) should outrank due-later (${dueLater})`);
});

test('priority keeps overdue items at peak urgency rather than dropping them', () => {
  const overdue = priority({ ...baseItem, dueDate: '2026-04-20' }, FIXED_TODAY);
  const dueToday = priority({ ...baseItem, dueDate: '2026-04-25' }, FIXED_TODAY);
  assert.equal(overdue, dueToday, 'overdue should not be quietly demoted below due-today');
});

test('priority demotes Complete below Running with otherwise identical fields', () => {
  const running = priority({ ...baseItem, state: 'Running' }, FIXED_TODAY);
  const complete = priority({ ...baseItem, state: 'Complete' }, FIXED_TODAY);
  assert.ok(running > complete, `running (${running}) should outrank complete (${complete})`);
});

test('priority rewards confidence and review cycles', () => {
  const cold = priority({ ...baseItem, confidence: 1, reviews: 0 }, FIXED_TODAY);
  const warm = priority({ ...baseItem, confidence: 9, reviews: 4 }, FIXED_TODAY);
  assert.ok(warm > cold, `warm (${warm}) should outrank cold (${cold})`);
});

test('priority penalises higher effort when other signals are equal', () => {
  const easy = priority({ ...baseItem, effort: 1 }, FIXED_TODAY);
  const hard = priority({ ...baseItem, effort: 9 }, FIXED_TODAY);
  assert.ok(easy > hard, `easy (${easy}) should outrank hard (${hard})`);
});
