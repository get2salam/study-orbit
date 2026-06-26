import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildCoachBrief } from '../js/coachBrief.js';
import { scoreCoachResponse } from '../js/agentEval.js';

const FIXED_TODAY = new Date('2026-04-25T00:00:00');
const item = (overrides = {}) => ({
  title: 'Past paper sprint',
  module: 'Exam drills',
  state: 'Planned',
  score: 9,
  effort: 5,
  confidence: 4,
  minutes: 120,
  reviews: 0,
  dueDate: '2026-04-25',
  ...overrides,
});

function brief() {
  return buildCoachBrief([
    item(),
    item({ title: 'Reading notes', module: 'RL', confidence: 8, reviews: 2, dueDate: '2026-05-04' }),
  ], { today: FIXED_TODAY });
}

test('scoreCoachResponse passes a focused, timeboxed study-coach reply', () => {
  const result = scoreCoachResponse(
    'Start with Past paper sprint for Exam drills because the deadline is today. Do a 45 minute past paper practice block, then review mistakes and rate your confidence from 1-10.',
    brief(),
  );

  assert.equal(result.score, 100);
  assert.equal(result.passed, true);
  assert.deepEqual(result.reasons, []);
});

test('scoreCoachResponse flags generic agent output that misses the brief', () => {
  const result = scoreCoachResponse(
    'You should study hard and stay motivated. Keep going and try your best.',
    brief(),
  );

  assert.equal(result.passed, false);
  assert.equal(result.checks.mentionsTopFocus, false);
  assert.equal(result.checks.givesTimebox, false);
  assert.ok(result.reasons.length >= 3);
});

test('scoreCoachResponse is deterministic and configurable for stricter eval gates', () => {
  const response = 'Past paper sprint is due soon. Spend 20 minutes on practice, review errors, and log confidence.';
  const first = scoreCoachResponse(response, brief(), { passingScore: 90, maxWords: 20 });
  const second = scoreCoachResponse(response, brief(), { passingScore: 90, maxWords: 20 });

  assert.deepEqual(first, second);
  assert.equal(first.score, 100);
  assert.equal(first.passed, true);
});
