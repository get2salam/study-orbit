import { daysFromToday, priority } from './scoring.js';

const DEFAULT_LIMIT = 3;
const RISK_ORDER = ['overdue', 'deadline-risk', 'low-confidence', 'unreviewed', 'steady'];

function label(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function riskFor(item, today) {
  if (item.state === 'Complete') return 'complete';
  const days = daysFromToday(item.dueDate, today);
  if (days < 0) return 'overdue';
  if (days <= 2 && item.confidence <= 5) return 'deadline-risk';
  if (item.confidence <= 4) return 'low-confidence';
  if (item.reviews === 0 && days <= 7) return 'unreviewed';
  return 'steady';
}

function briefItem(item, today) {
  return {
    title: label(item.title, 'Untitled session'),
    module: label(item.module, 'Module or topic'),
    risk: riskFor(item, today),
    priority: priority(item, today),
    daysUntilDue: daysFromToday(item.dueDate, today),
    confidence: item.confidence,
    reviews: item.reviews,
    minutes: item.minutes,
  };
}

export function buildCoachBrief(items, { today = new Date(), limit = DEFAULT_LIMIT } = {}) {
  const sessions = Array.isArray(items) ? items : [];
  const active = sessions.filter((item) => item && item.state !== 'Complete');
  const cappedLimit = Math.max(1, Math.min(10, Math.round(Number(limit) || DEFAULT_LIMIT)));
  const focusQueue = active.map((item) => briefItem(item, today)).sort((a, b) => (
    RISK_ORDER.indexOf(a.risk) - RISK_ORDER.indexOf(b.risk)
      || b.priority - a.priority
      || a.daysUntilDue - b.daysUntilDue
      || a.title.localeCompare(b.title)
  )).slice(0, cappedLimit);

  return {
    summary: {
      totalSessions: sessions.length,
      activeSessions: active.length,
      overdue: active.filter((item) => daysFromToday(item.dueDate, today) < 0).length,
      lowConfidence: active.filter((item) => item.confidence <= 4).length,
      unreviewedDueSoon: active.filter((item) => item.reviews === 0 && daysFromToday(item.dueDate, today) <= 7).length,
      plannedMinutes: active.reduce((sum, item) => sum + item.minutes, 0),
    },
    focusQueue,
    coachPrompt: focusQueue.length
      ? `Coach ${focusQueue.length} priority study blocks; start with ${focusQueue[0].title} because it is ${focusQueue[0].risk}.`
      : 'No active study blocks need coaching; suggest a light review or recovery plan.',
  };
}
