import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildCoachBrief } from '../js/coachBrief.js';

const FIXED_TODAY = new Date('2026-04-25T00:00:00');
const item = (overrides = {}) => ({
  title: 'Study block',
  module: 'AI systems',
  state: 'Planned',
  score: 7,
  effort: 3,
  confidence: 6,
  minutes: 60,
  reviews: 1,
  dueDate: '2026-04-29',
  ...overrides,
});

test('buildCoachBrief summarizes active study risk for an agent prompt', () => {
  const brief = buildCoachBrief([
    item({ title: 'Overdue drill', confidence: 3, reviews: 0, minutes: 90, dueDate: '2026-04-22' }),
    item({ title: 'Completed reading', state: 'Complete', confidence: 9, minutes: 45 }),
    item({ title: 'Fresh flashcards', confidence: 4, reviews: 0, minutes: 30, dueDate: '2026-04-27' }),
  ], { today: FIXED_TODAY });

  assert.deepEqual(brief.summary, {
    totalSessions: 3,
    activeSessions: 2,
    overdue: 1,
    lowConfidence: 2,
    unreviewedDueSoon: 2,
    plannedMinutes: 120,
  });
  assert.equal(brief.focusQueue[0].risk, 'overdue');
  assert.match(brief.coachPrompt, /Overdue drill/);
});

test('buildCoachBrief ranks risks deterministically and handles empty input', () => {
  const brief = buildCoachBrief([
    item({ title: 'Low confidence later', confidence: 3, dueDate: '2026-05-10' }),
    item({ title: 'Due soon shaky', confidence: 5, dueDate: '2026-04-26' }),
    item({ title: 'Stable practice', confidence: 7, dueDate: '2026-04-26' }),
  ], { today: FIXED_TODAY, limit: 2 });

  assert.deepEqual(brief.focusQueue.map((entry) => [entry.title, entry.risk]), [
    ['Due soon shaky', 'deadline-risk'],
    ['Low confidence later', 'low-confidence'],
  ]);

  const empty = buildCoachBrief(null, { today: FIXED_TODAY, limit: -20 });
  assert.equal(empty.focusQueue.length, 0);
  assert.match(empty.coachPrompt, /No active study blocks/);
});

test('buildCoachBrief tolerates a malformed dueDate instead of misclassifying it as overdue', () => {
  const brief = buildCoachBrief([
    item({ title: 'Corrupted date entry', dueDate: 'not-a-date', confidence: 7, reviews: 2 }),
  ], { today: FIXED_TODAY });

  const [entry] = brief.focusQueue;
  assert.notEqual(entry.risk, 'overdue');
  assert.equal(entry.daysUntilDue, 999);
  assert.ok(Number.isFinite(entry.priority), `priority should be finite, got ${entry.priority}`);
});
