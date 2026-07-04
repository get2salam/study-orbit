#!/usr/bin/env node
// Runnable walkthrough for the offline AI-coach eval loop documented in the README:
// build a coach brief from a sample board, then grade two candidate replies against
// the deterministic rubric in js/agentEval.js.
import { buildCoachBrief } from '../js/coachBrief.js';
import { scoreCoachResponse } from '../js/agentEval.js';

const today = new Date('2026-04-25T00:00:00');

const items = [
  {
    title: 'Past paper sprint', module: 'Exam drills', state: 'Planned',
    score: 9, effort: 5, confidence: 4, minutes: 120, reviews: 0, dueDate: '2026-04-25',
  },
  {
    title: 'Reading notes', module: 'Reinforcement learning', state: 'Solid',
    score: 6, effort: 3, confidence: 8, minutes: 45, reviews: 2, dueDate: '2026-05-04',
  },
  {
    title: 'Lab writeup', module: 'Applied stats', state: 'Running',
    score: 7, effort: 6, confidence: 3, minutes: 90, reviews: 0, dueDate: '2026-04-27',
  },
];

const candidateReplies = {
  strong: 'Start with Past paper sprint for Exam drills because the deadline is today. Do a 45 minute past paper practice block, then review mistakes and rate your confidence from 1-10.',
  weak: 'You should study hard and stay motivated. Keep going and try your best.',
};

export function runExample() {
  const brief = buildCoachBrief(items, { today });
  const results = Object.fromEntries(
    Object.entries(candidateReplies).map(([label, text]) => [label, scoreCoachResponse(text, brief)]),
  );
  return { brief, results };
}

function printReport() {
  const { brief, results } = runExample();
  console.log(`Coach prompt: ${brief.coachPrompt}\n`);
  for (const [label, result] of Object.entries(results)) {
    console.log(`${label} reply -> score ${result.score} (${result.passed ? 'PASS' : 'FAIL'})`);
    if (result.reasons.length) console.log(`  ${result.reasons.join(' ')}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  printReport();
}
