import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runExample } from '../examples/scoreCoachReply.mjs';

test('README walkthrough: strong reply passes and weak reply fails the rubric', () => {
  const { brief, results } = runExample();

  assert.equal(brief.focusQueue[0].title, 'Past paper sprint');
  assert.equal(brief.focusQueue[0].risk, 'deadline-risk');

  assert.equal(results.strong.score, 100);
  assert.equal(results.strong.passed, true);
  assert.deepEqual(results.strong.reasons, []);

  assert.equal(results.weak.passed, false);
  assert.ok(results.weak.score < results.strong.score);
  assert.ok(results.weak.reasons.length >= 3);
});

test('runExample stays deterministic across calls', () => {
  assert.deepEqual(runExample(), runExample());
});
