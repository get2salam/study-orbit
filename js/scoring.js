// Pure scoring + sanitization helpers shared between the browser app and tests.
// Keep this module DOM-free so node:test can import it directly.

export const ITEM_NUMBER_BOUNDS = {
  score: { min: 1, max: 10, fallback: 7 },
  effort: { min: 1, max: 10, fallback: 3 },
  confidence: { min: 1, max: 10, fallback: 5 },
  minutes: { min: 0, max: 1440, fallback: 60 },
  reviews: { min: 0, max: 999, fallback: 0 },
};

export const ITEM_STRING_BOUNDS = {
  title: { maxLength: 120, fallback: 'New session' },
  module: { maxLength: 80, fallback: 'Module or topic' },
  note: {
    maxLength: 600,
    fallback: 'Capture the goal of this study block and what would make it feel complete.',
  },
};

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const STATE_BOOSTS = { Running: 7, Planned: 4, Solid: 3, Complete: -2 };

export function clampNumber(value, { min, max, fallback }) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

export function sanitizeString(value, { maxLength, fallback }) {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

export function validIsoDate(value, fallback) {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : value;
}

export function daysFromToday(value, today = new Date()) {
  if (!value) return 999;
  const anchor = new Date(today);
  anchor.setHours(0, 0, 0, 0);
  const target = new Date(`${value}T00:00:00`);
  // A malformed or nonsense due date (agent-generated boards aren't guaranteed
  // to run through validIsoDate first) must not leak NaN into priority() and
  // risk classification downstream; treat it like "no due date" instead.
  if (Number.isNaN(target.getTime())) return 999;
  return Math.round((target - anchor) / 86400000);
}

export function priority(item, today = new Date()) {
  const days = daysFromToday(item.dueDate, today);
  const dueBoost = Math.max(0, 7 - Math.max(days, 0)) * 3;
  const stateBoost = STATE_BOOSTS[item.state] ?? 0;
  return item.score * 7 + item.confidence * 4 + item.reviews * 2 + dueBoost + stateBoost - item.effort * 3;
}
