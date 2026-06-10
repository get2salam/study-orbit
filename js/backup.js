// Pure parsing/validation for imported JSON backups.
// Lives outside the DOM so node:test can exercise it directly.

import { sanitizeString, ITEM_STRING_BOUNDS } from './scoring.js';

// Cap raw payload bytes before JSON.parse so a 1GB paste cannot freeze the tab.
export const MAX_BACKUP_BYTES = 1_000_000;

// Cap the item count so a malicious file with millions of entries cannot stall render().
export const MAX_BACKUP_ITEMS = 5_000;

// Own-key names that, if accepted blindly into the state tree, can pollute Object.prototype
// or shadow built-ins. We drop any item that carries one of these as an own key.
export const DANGEROUS_ITEM_KEYS = Object.freeze(['__proto__', 'constructor', 'prototype']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasDangerousKey(item) {
  for (const key of DANGEROUS_ITEM_KEYS) {
    if (Object.prototype.hasOwnProperty.call(item, key)) return true;
  }
  return false;
}

export function parseBackup(rawText, { normalizeItem } = {}) {
  if (typeof rawText !== 'string') {
    throw new Error('Backup payload must be text.');
  }
  if (rawText.length > MAX_BACKUP_BYTES) {
    throw new Error(`Backup is too large (limit ${MAX_BACKUP_BYTES} characters).`);
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('Backup file is not valid JSON.');
  }

  if (!isPlainObject(parsed)) {
    throw new Error('Backup must be a JSON object.');
  }
  if (!Array.isArray(parsed.items)) {
    throw new Error('Backup is missing an "items" array.');
  }

  const capped = parsed.items.slice(0, MAX_BACKUP_ITEMS);
  let dropped = parsed.items.length - capped.length;

  const safeItems = [];
  for (const candidate of capped) {
    if (!isPlainObject(candidate) || hasDangerousKey(candidate)) {
      dropped += 1;
      continue;
    }
    safeItems.push(typeof normalizeItem === 'function' ? normalizeItem(candidate) : candidate);
  }

  const boardTitle = sanitizeString(parsed.boardTitle, ITEM_STRING_BOUNDS.title);
  const boardSubtitle = sanitizeString(parsed.boardSubtitle, ITEM_STRING_BOUNDS.note);
  const ui = isPlainObject(parsed.ui) && !hasDangerousKey(parsed.ui) ? parsed.ui : {};

  return { boardTitle, boardSubtitle, items: safeItems, ui, dropped };
}
