// Deterministic rubric for evaluating AI study-coach replies.
// Keep this module dependency-free so CI can score prompt changes offline.

const DEFAULT_PASSING_SCORE = 70;
const DEFAULT_MAX_WORDS = 160;
const RISK_TERMS = Object.freeze({
  overdue: ['overdue', 'late', 'missed', 'catch up'],
  'deadline-risk': ['deadline', 'due', 'urgent', 'soon'],
  'low-confidence': ['confidence', 'weak', 'uncertain', 'gap'],
  unreviewed: ['review', 'recall', 'quiz', 'flashcard'],
  steady: ['steady', 'maintain', 'continue', 'next block'],
});

function normalize(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function wordCount(text) {
  return normalize(text).split(' ').filter(Boolean).length;
}

function mentionsFocus(text, focus) {
  const title = normalize(focus?.title);
  const module = normalize(focus?.module);
  return Boolean((title && text.includes(title)) || (module && text.includes(module)));
}

function riskIsAddressed(text, risk) {
  return includesAny(text, RISK_TERMS[risk] || []);
}

export function scoreCoachResponse(responseText, brief, {
  passingScore = DEFAULT_PASSING_SCORE,
  maxWords = DEFAULT_MAX_WORDS,
} = {}) {
  const text = normalize(responseText);
  const topFocus = Array.isArray(brief?.focusQueue) ? brief.focusQueue[0] : null;

  const checks = {
    mentionsTopFocus: topFocus ? mentionsFocus(text, topFocus) : false,
    addressesTopRisk: topFocus ? riskIsAddressed(text, topFocus.risk) : false,
    givesTimebox: /\b\d+\s?(min|mins|minute|minutes|h|hr|hrs|hour|hours)\b/.test(text),
    includesReviewAction: includesAny(text, ['review', 'recall', 'quiz', 'flashcard', 'past paper', 'practice']),
    checksConfidence: includesAny(text, ['confidence', 'rate yourself', 'traffic light', 'red amber green']),
    staysConcise: wordCount(text) > 0 && wordCount(text) <= maxWords,
  };

  const weights = {
    mentionsTopFocus: 25,
    addressesTopRisk: 20,
    givesTimebox: 15,
    includesReviewAction: 15,
    checksConfidence: 15,
    staysConcise: 10,
  };

  const score = Object.entries(checks).reduce((total, [key, passed]) => (
    passed ? total + weights[key] : total
  ), 0);

  return {
    score,
    passed: score >= passingScore,
    checks,
    reasons: Object.entries(checks)
      .filter(([, passed]) => !passed)
      .map(([key]) => `Missing ${key}.`),
  };
}
