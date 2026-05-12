const CONFIG = {
  slug: 'study-orbit',
  title: 'Study Orbit',
  boardTitle: 'MS AI study orbit',
  boardSubtitle: 'Sessions, review cycles, and readiness markers in one place.',
  categories: ['Reading', 'Practice', 'Revision', 'Exam prep'],
  states: ['Planned', 'Running', 'Solid', 'Complete'],
  items: [
    {
      title: 'Reinforcement learning notes',
      category: 'Reading',
      state: 'Running',
      score: 8,
      effort: 4,
      confidence: 6,
      minutes: 90,
      reviews: 1,
      module: 'Reinforcement Learning',
      dueDate: '2026-04-27',
      note: 'Summarize each section into one plain-English teaching paragraph.',
    },
    {
      title: 'Past paper sprint',
      category: 'Practice',
      state: 'Planned',
      score: 9,
      effort: 5,
      confidence: 5,
      minutes: 120,
      reviews: 0,
      module: 'Exam drills',
      dueDate: '2026-04-25',
      note: 'Timeboxed question set with an error log to expose weak spots quickly.',
    },
    {
      title: 'Concept compression review',
      category: 'Revision',
      state: 'Solid',
      score: 7,
      effort: 2,
      confidence: 8,
      minutes: 45,
      reviews: 3,
      module: 'Model compression',
      dueDate: '2026-04-29',
      note: 'Reduce each topic to a flashcard deck and one whiteboard explanation.',
    },
  ],
};

const STORAGE_KEY = `${CONFIG.slug}/state/v2`;
const NUMBER_FIELDS = new Set(['score', 'effort', 'confidence', 'minutes', 'reviews']);
const ITEM_NUMBER_BOUNDS = {
  score: { min: 1, max: 10, fallback: 7 },
  effort: { min: 1, max: 10, fallback: 3 },
  confidence: { min: 1, max: 10, fallback: 5 },
  minutes: { min: 0, max: 1440, fallback: 60 },
  reviews: { min: 0, max: 999, fallback: 0 },
};
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function clampNumber(value, { min, max, fallback }) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function validIsoDate(value, fallback) {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : value;
}

const refs = {
  boardTitle: document.querySelector('[data-role="board-title"]'),
  boardSubtitle: document.querySelector('[data-role="board-subtitle"]'),
  stats: document.querySelector('[data-role="stats"]'),
  insights: document.querySelector('[data-role="insights"]'),
  count: document.querySelector('[data-role="count"]'),
  list: document.querySelector('[data-role="list"]'),
  editor: document.querySelector('[data-role="editor"]'),
  secondaryPrimary: document.querySelector('[data-role="secondary-primary"]'),
  secondarySecondary: document.querySelector('[data-role="secondary-secondary"]'),
  search: document.querySelector('[data-field="search"]'),
  category: document.querySelector('[data-field="category"]'),
  status: document.querySelector('[data-field="status"]'),
  importFile: document.querySelector('#import-file'),
};

const toastHost = (() => {
  const host = document.createElement('div');
  host.className = 'toast-host';
  document.body.appendChild(host);
  return host;
})();

function showToast(message) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  toastHost.appendChild(node);
  requestAnimationFrame(() => node.classList.add('is-visible'));
  setTimeout(() => {
    node.classList.remove('is-visible');
    setTimeout(() => node.remove(), 200);
  }, 2200);
}

function uid() {
  return `${CONFIG.slug}_${Math.random().toString(36).slice(2, 10)}`;
}

function todayISO(offset = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function daysFromToday(value) {
  if (!value) return 999;
  const today = new Date(`${todayISO()}T00:00:00`);
  const target = new Date(`${value}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

function bumpDate(value, days) {
  const date = new Date(`${value || todayISO()}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return 'No date';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function dueBadge(item) {
  const days = daysFromToday(item.dueDate);
  const formatted = formatDate(item.dueDate);
  if (item.state === 'Complete') return { tone: 'success', label: `Due ${formatted}` };
  if (days < 0) return { tone: 'danger', label: `Overdue ${formatted}` };
  if (days <= 2) return { tone: 'warn', label: `Due ${formatted}` };
  return { tone: 'success', label: `Due ${formatted}` };
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalize(item = {}) {
  return {
    id: item.id || uid(),
    title: item.title || 'New session',
    category: CONFIG.categories.includes(item.category) ? item.category : CONFIG.categories[0],
    state: CONFIG.states.includes(item.state) ? item.state : CONFIG.states[0],
    score: clampNumber(item.score, ITEM_NUMBER_BOUNDS.score),
    effort: clampNumber(item.effort, ITEM_NUMBER_BOUNDS.effort),
    confidence: clampNumber(item.confidence, ITEM_NUMBER_BOUNDS.confidence),
    minutes: clampNumber(item.minutes, ITEM_NUMBER_BOUNDS.minutes),
    reviews: clampNumber(item.reviews, ITEM_NUMBER_BOUNDS.reviews),
    module: item.module || 'Module or topic',
    dueDate: validIsoDate(item.dueDate, todayISO(2)),
    note: item.note || 'Capture the goal of this study block and what would make it feel complete.',
  };
}

function priority(item) {
  const dueBoost = Math.max(0, 7 - Math.max(daysFromToday(item.dueDate), 0)) * 3;
  const stateBoost = item.state === 'Running' ? 7 : item.state === 'Planned' ? 4 : item.state === 'Solid' ? 3 : -2;
  return item.score * 7 + item.confidence * 4 + item.reviews * 2 + dueBoost + stateBoost - item.effort * 3;
}

function seedState() {
  return {
    boardTitle: CONFIG.boardTitle,
    boardSubtitle: CONFIG.boardSubtitle,
    items: CONFIG.items.map((item) => normalize(item)),
    ui: { search: '', category: 'all', status: 'all', selectedId: null },
  };
}

function hydrate() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw);
    return {
      ...seedState(),
      ...parsed,
      items: (parsed.items || []).map((item) => normalize(item)),
      ui: { ...seedState().ui, ...(parsed.ui || {}) },
    };
  } catch (error) {
    console.warn('Falling back to seed state', error);
    return seedState();
  }
}

let state = hydrate();
if (!state.ui.selectedId && state.items[0]) state.ui.selectedId = state.items[0].id;

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function filteredItems() {
  const query = state.ui.search.trim().toLowerCase();
  return [...state.items]
    .filter((item) => state.ui.category === 'all' || item.category === state.ui.category)
    .filter((item) => state.ui.status === 'all' || item.state === state.ui.status)
    .filter((item) => !query || `${item.title} ${item.note} ${item.category} ${item.state} ${item.module}`.toLowerCase().includes(query))
    .sort((a, b) => priority(b) - priority(a) || daysFromToday(a.dueDate) - daysFromToday(b.dueDate));
}

function selectedItem() {
  return state.items.find((item) => item.id === state.ui.selectedId) || filteredItems()[0] || null;
}

function commit(nextState) {
  state = nextState;
  if (!state.ui.selectedId && state.items[0]) state.ui.selectedId = state.items[0].id;
  persist();
  render();
}

function coerceField(field, value) {
  if (field === 'dueDate') return validIsoDate(value, todayISO(2));
  if (NUMBER_FIELDS.has(field)) return clampNumber(value, ITEM_NUMBER_BOUNDS[field]);
  return value;
}

function updateSelected(field, value) {
  const target = selectedItem();
  if (!target) return;
  commit({
    ...state,
    items: state.items.map((item) => item.id === target.id ? { ...item, [field]: coerceField(field, value) } : item),
  });
}

function addItem() {
  const item = normalize({ title: 'New study block', module: 'Module or topic', confidence: 5, minutes: 60 });
  commit({
    ...state,
    items: [item, ...state.items],
    ui: { ...state.ui, selectedId: item.id },
  });
  showToast('Added a new study block.');
}

function removeSelected() {
  const target = selectedItem();
  if (!target) return;
  const nextItems = state.items.filter((item) => item.id !== target.id);
  commit({
    ...state,
    items: nextItems,
    ui: { ...state.ui, selectedId: nextItems[0]?.id || null },
  });
  showToast('Removed study block.');
}

function exportState() {
  const blob = new Blob([JSON.stringify({ schema: `${CONFIG.slug}/v2`, ...state }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${CONFIG.slug}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('Downloaded backup.');
}

function parseBackup(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Backup file is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Backup must be a JSON object.');
  }
  if (!Array.isArray(parsed.items)) {
    throw new Error('Backup is missing an "items" array.');
  }
  return parsed;
}

async function importState(file) {
  const parsed = parseBackup(await file.text());
  commit({
    ...seedState(),
    ...parsed,
    items: parsed.items.map((item) => normalize(item)),
    ui: { ...seedState().ui, ...(parsed.ui || {}) },
  });
  showToast('Imported backup.');
}

function startFocusBlock() {
  const target = selectedItem();
  if (!target) return;
  commit({
    ...state,
    items: state.items.map((item) => item.id === target.id ? { ...item, state: 'Running' } : item),
  });
  showToast('Marked this session as running.');
}

function logReviewCycle() {
  const target = selectedItem();
  if (!target) return;
  commit({
    ...state,
    items: state.items.map((item) => item.id === target.id ? {
      ...item,
      reviews: item.reviews + 1,
      confidence: Math.min(10, item.confidence + 1),
      dueDate: bumpDate(item.dueDate, 2),
      state: item.state === 'Complete' ? 'Solid' : item.state,
    } : item),
  });
  showToast('Logged a review cycle.');
}

function markComplete() {
  const target = selectedItem();
  if (!target) return;
  commit({
    ...state,
    items: state.items.map((item) => item.id === target.id ? { ...item, state: 'Complete', confidence: Math.max(item.confidence, 8) } : item),
  });
  showToast('Marked this session complete.');
}

function renderStats(items) {
  const totalMinutes = state.items.reduce((sum, item) => sum + item.minutes, 0);
  const dueSoon = state.items.filter((item) => daysFromToday(item.dueDate) <= 7 && item.state !== 'Complete').length;
  const avgConfidence = state.items.length ? (state.items.reduce((sum, item) => sum + item.confidence, 0) / state.items.length).toFixed(1) : '0.0';
  const complete = state.items.filter((item) => item.state === 'Complete').length;
  const cards = [
    ['Sessions', String(state.items.length), 'tracked learning blocks'],
    ['Planned minutes', `${totalMinutes}m`, 'current board workload'],
    ['Due this week', String(dueSoon), 'sessions needing near-term focus'],
    ['Confidence', avgConfidence, `${complete} sessions fully complete`],
  ];
  refs.stats.innerHTML = cards.map(([label, valueText, note]) => `
    <article class="card stat">
      <span>${label}</span>
      <strong>${valueText}</strong>
      <small>${note}</small>
    </article>
  `).join('');
  refs.count.textContent = items[0] ? `Top: ${items[0].title}` : 'No sessions';
}

function renderInsights(items) {
  const nextDue = [...state.items].sort((a, b) => daysFromToday(a.dueDate) - daysFromToday(b.dueDate))[0];
  const mostConfident = [...state.items].sort((a, b) => b.confidence - a.confidence)[0];
  const heaviest = [...state.items].sort((a, b) => b.minutes - a.minutes)[0];
  const cards = [
    {
      label: 'Next deadline',
      title: nextDue?.title || 'No session yet',
      body: nextDue ? `${formatDate(nextDue.dueDate)} · ${nextDue.module}.` : 'Add a session to anchor the week.',
    },
    {
      label: 'Strongest confidence',
      title: mostConfident?.title || 'Nothing reviewed yet',
      body: mostConfident ? `${mostConfident.confidence}/10 confidence after ${mostConfident.reviews} review cycles.` : 'Confidence grows when you revisit the hard parts.',
    },
    {
      label: 'Longest block',
      title: heaviest?.title || 'No block planned',
      body: heaviest ? `${heaviest.minutes} minute session with priority ${priority(heaviest)}.` : 'Longer blocks show up once a serious sprint lands here.',
    },
  ];
  refs.insights.innerHTML = cards.map((card) => `
    <article class="card insight-card">
      <p class="eyebrow">${card.label}</p>
      <h3>${escapeHtml(card.title)}</h3>
      <p>${escapeHtml(card.body)}</p>
    </article>
  `).join('');
}

function renderList(items) {
  if (!items.length) {
    refs.list.innerHTML = `
      <div class="empty">
        <strong>No study sessions yet</strong>
        <p>Map the sessions that matter and keep your revision honest.</p>
      </div>
    `;
    return;
  }

  refs.list.innerHTML = items.map((item) => {
    const due = dueBadge(item);
    return `
    <button class="item ${item.id === state.ui.selectedId ? 'is-selected' : ''}" type="button" data-id="${escapeHtml(item.id)}">
      <div class="item-top">
        <strong>${escapeHtml(item.title)}</strong>
        <span class="score">${priority(item)}</span>
      </div>
      <p>${escapeHtml(item.note)}</p>
      <div class="badge-row">
        <span class="pill ${due.tone}">${due.label}</span>
        <span class="pill">${item.minutes} min</span>
        <span class="pill">${escapeHtml(item.module)}</span>
      </div>
      <div class="meta">
        <span>${escapeHtml(item.category)}</span>
        <span>${escapeHtml(item.state)}</span>
        <span>Confidence ${item.confidence}/10</span>
        <span>${item.reviews} review cycles</span>
      </div>
    </button>
  `;
  }).join('');
}

function renderEditor(item) {
  if (!item) {
    refs.editor.innerHTML = `
      <div class="empty">
        <strong>No selection</strong>
        <p>Pick a session or create a new one.</p>
      </div>
    `;
    return;
  }

  refs.editor.innerHTML = `
    <div class="editor-head">
      <div>
        <p class="eyebrow">Study editor</p>
        <h3>${escapeHtml(item.title)}</h3>
      </div>
      <span class="score">Priority ${priority(item)}</span>
    </div>
    <div class="editor-grid">
      <label class="field">
        <span>Session title</span>
        <input type="text" data-item-field="title" value="${escapeHtml(item.title)}" />
      </label>
      <label class="field">
        <span>Module or topic</span>
        <input type="text" data-item-field="module" value="${escapeHtml(item.module)}" />
      </label>
      <label class="field">
        <span>Session note</span>
        <textarea data-item-field="note">${escapeHtml(item.note)}</textarea>
      </label>
      <div class="field-grid">
        <label class="field">
          <span>Type</span>
          <select data-item-field="category">${CONFIG.categories.map((entry) => `<option value="${entry}" ${item.category === entry ? 'selected' : ''}>${entry}</option>`).join('')}</select>
        </label>
        <label class="field">
          <span>Status</span>
          <select data-item-field="state">${CONFIG.states.map((entry) => `<option value="${entry}" ${item.state === entry ? 'selected' : ''}>${entry}</option>`).join('')}</select>
        </label>
      </div>
      <div class="field-grid">
        <label class="field">
          <span>Due date</span>
          <input type="date" data-item-field="dueDate" value="${item.dueDate}" />
        </label>
        <label class="field">
          <span>Minutes planned</span>
          <input type="number" min="15" step="15" data-item-field="minutes" value="${item.minutes}" />
        </label>
      </div>
      <div class="field-grid three">
        <label class="field range-wrap">
          <span>Confidence</span>
          <input type="range" min="1" max="10" data-item-field="confidence" value="${item.confidence}" />
          <output>${item.confidence} / 10</output>
        </label>
        <label class="field range-wrap">
          <span>Signal</span>
          <input type="range" min="1" max="10" data-item-field="score" value="${item.score}" />
          <output>${item.score} / 10</output>
        </label>
        <label class="field range-wrap">
          <span>Effort</span>
          <input type="range" min="1" max="10" data-item-field="effort" value="${item.effort}" />
          <output>${item.effort} / 10</output>
        </label>
      </div>
      <label class="field">
        <span>Review cycles logged</span>
        <input type="number" min="0" step="1" data-item-field="reviews" value="${item.reviews}" />
      </label>
      <div class="quick-actions">
        <button class="btn" type="button" data-action="start-focus">Start focus block</button>
        <button class="btn" type="button" data-action="log-review">Log review cycle</button>
        <button class="btn" type="button" data-action="mark-complete">Mark complete</button>
      </div>
      <div class="editor-actions">
        <span class="helper">${dueBadge(item).label}, ${item.minutes} planned minutes, ${item.reviews} review cycles.</span>
        <button class="btn btn-danger" type="button" data-action="remove-current">Remove</button>
      </div>
    </div>
  `;
}

function renderOrbitPanels() {
  const active = [...state.items].filter((item) => item.state !== 'Complete').sort((a, b) => daysFromToday(a.dueDate) - daysFromToday(b.dueDate) || priority(b) - priority(a));
  refs.secondaryPrimary.innerHTML = `
    <div class="secondary-head">
      <div>
        <p class="eyebrow">Today orbit</p>
        <h3>Next three study blocks</h3>
      </div>
      <span class="chip">${active.length} live</span>
    </div>
    <div class="stack">
      ${active.slice(0, 3).map((item) => {
        const due = dueBadge(item);
        return `
        <div class="mini-card">
          <div class="inline-split">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="pill ${due.tone}">${due.label}</span>
          </div>
          <p>${item.minutes} minutes, ${item.confidence}/10 confidence, ${escapeHtml(item.module)}.</p>
        </div>
      `;
      }).join('') || `<div class="empty"><strong>Nothing queued</strong><p>Everything is complete. Nicely done.</p></div>`}
    </div>
  `;

  const byCategory = CONFIG.categories.map((entry) => ({ entry, minutes: state.items.filter((item) => item.category === entry).reduce((sum, item) => sum + item.minutes, 0) }));
  refs.secondarySecondary.innerHTML = `
    <div class="secondary-head">
      <div>
        <p class="eyebrow">Load map</p>
        <h3>Where the minutes are going</h3>
      </div>
      <span class="chip">${state.items.reduce((sum, item) => sum + item.reviews, 0)} reviews</span>
    </div>
    <ul class="metric-list">
      ${byCategory.map(({ entry, minutes }) => `<li><span>${escapeHtml(entry)}</span><strong>${minutes}m</strong></li>`).join('')}
      <li><span>Nearest deadline</span><strong>${active[0] ? escapeHtml(active[0].title) : '—'}</strong></li>
    </ul>
  `;
}

function render() {
  refs.boardTitle.textContent = state.boardTitle;
  refs.boardSubtitle.textContent = state.boardSubtitle;
  refs.search.value = state.ui.search;
  refs.category.innerHTML = `<option value="all">All types</option>${CONFIG.categories.map((entry) => `<option value="${entry}" ${state.ui.category === entry ? 'selected' : ''}>${entry}</option>`).join('')}`;
  refs.status.innerHTML = `<option value="all">All statuses</option>${CONFIG.states.map((entry) => `<option value="${entry}" ${state.ui.status === entry ? 'selected' : ''}>${entry}</option>`).join('')}`;
  const items = filteredItems();
  if (!items.some((item) => item.id === state.ui.selectedId)) state.ui.selectedId = items[0]?.id || null;
  renderStats(items);
  renderInsights(items);
  renderList(items);
  renderEditor(selectedItem());
  renderOrbitPanels();
}

document.addEventListener('click', (event) => {
  const itemButton = event.target.closest('.item');
  if (itemButton) {
    commit({ ...state, ui: { ...state.ui, selectedId: itemButton.dataset.id } });
    return;
  }

  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'new') addItem();
  if (action === 'reset') { commit(seedState()); showToast('Re-seeded sample board.'); }
  if (action === 'remove-current') removeSelected();
  if (action === 'export') exportState();
  if (action === 'import') refs.importFile.click();
  if (action === 'start-focus') startFocusBlock();
  if (action === 'log-review') logReviewCycle();
  if (action === 'mark-complete') markComplete();
});

document.addEventListener('input', (event) => {
  const field = event.target.dataset.field;
  if (field === 'search') {
    commit({ ...state, ui: { ...state.ui, search: event.target.value } });
    return;
  }
  const itemField = event.target.dataset.itemField;
  if (itemField) updateSelected(itemField, event.target.value);
});

document.addEventListener('change', async (event) => {
  const field = event.target.dataset.field;
  if (field === 'category' || field === 'status') {
    commit({ ...state, ui: { ...state.ui, [field]: event.target.value } });
    return;
  }
  if (event.target.id === 'import-file') {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await importState(file);
    } catch (error) {
      console.error(error);
      showToast(error?.message || 'Import failed.');
    } finally {
      event.target.value = '';
    }
  }
});

document.addEventListener('keydown', (event) => {
  if (event.target.closest('input, textarea, select')) return;
  if (event.key.toLowerCase() === 'n') {
    event.preventDefault();
    addItem();
  }
  if (event.key === '/') {
    event.preventDefault();
    refs.search.focus();
  }
});

render();
