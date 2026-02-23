// CDN dependencies are pinned to exact versions for supply-chain safety.
// To update: check https://www.npmjs.com/package/lit-html for latest version.
import { render } from 'https://cdn.jsdelivr.net/npm/lit-html@3.3.2/+esm';
import {
  renderBulletin,
  renderClockworks,
  renderRegistry,
  renderWorkshop,
} from './components.js';
import { state, subscribe, toggleFilter, update } from './state.js';
import { renderVillage, setVillageVisible } from './village.js';

const $ = (s) => document.querySelector(s);

const layoutEl = $('.layout');
const registryEl = $('.registry');
const bulletinEl = $('.bulletin');
const workshopEl = $('.workshop');
const clockworksEl = $('.clockworks');
const villageEl = $('#village-container');
const isDesktop = () => matchMedia('(min-width: 1201px)').matches;

// Inject hamburger + backdrop if missing from HTML
if (!$('.hamburger') && layoutEl) {
  const btn = document.createElement('button');
  btn.className = 'hamburger';
  btn.setAttribute('aria-label', 'Toggle registry');
  btn.innerHTML = '<span></span><span></span><span></span>';
  layoutEl.prepend(btn);
}
if (!$('.backdrop') && layoutEl) {
  const el = document.createElement('div');
  el.className = 'backdrop';
  layoutEl.appendChild(el);
}

let scheduled = false;

function scheduleRender() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    const isStandalone = document.body.classList.contains('standalone-village');
    if (villageEl && (isStandalone || layoutEl?.classList.contains('show-village'))) {
      render(renderVillage(state), villageEl);
    }
    if (registryEl) render(renderRegistry(state), registryEl);
    if (bulletinEl) render(renderBulletin(state), bulletinEl);
    if (workshopEl) render(renderWorkshop(state), workshopEl);
    if (clockworksEl) render(renderClockworks(state), clockworksEl);
  });
}

function syncWorkshopCollapse() {
  if (!layoutEl) return;
  if (isDesktop()) {
    layoutEl.classList.toggle('workshop-collapsed', !state.selectedDelegate);
  } else {
    // Mobile/tablet use overlay pattern, not collapse class
    layoutEl.classList.remove('workshop-collapsed');
  }
}

subscribe(() => {
  scheduleRender();
  syncWorkshopCollapse();
});
scheduleRender();
syncWorkshopCollapse();

function sseOn(es, event, fn) {
  es.addEventListener(event, (e) => {
    try {
      fn(JSON.parse(e.data));
    } catch (err) {
      console.error(`[sse] ${event}:`, err);
    }
  });
}

function normalizeWallMsg(msg) {
  return {
    line: msg.line,
    time: msg.time || '',
    sender_id: msg.sender_id || '',
    message: msg.message || '',
    _receivedAt: Date.now(),
  };
}

function safeParse(json) {
  try { return JSON.parse(json); } catch { return []; }
}

function parseMessages(data) {
  return (data.messages || []).map((m) => ({
    ...m,
    content: typeof m.content_json === 'string' ? safeParse(m.content_json) : m.content_json || [],
  }));
}

function connectSSE() {
  const es = new EventSource('/events');

  es.onopen = () => {
    update({ connected: true });
    document.body.classList.add('connected');
    document.body.classList.remove('disconnected');
  };
  es.onerror = () => {
    update({ connected: false });
    document.body.classList.remove('connected');
    document.body.classList.add('disconnected');
    updateTabTitle();
  };

  sseOn(es, 'bootstrap', (data) => {
    const wallMessages = (data.wall?.lines || []).map(normalizeWallMsg);
    update({
      sessions: data.sessions?.rows || [],
      tree: data.tree || state.tree,
      wallMessages,
      stats: data.stats || state.stats,
      lastWallMessageTime: wallMessages.length ? Date.now() : null,
      connected: true,
    });
    updateTabTitle();
  });

  sseOn(es, 'wall', (raw) => {
    const msg = { ...normalizeWallMsg(raw), _isNew: true };
    const feed = $('.bulletin-feed');
    const nearTop = feed ? feed.scrollTop < 100 : true;
    const patch = {
      wallMessages: [...state.wallMessages, msg],
      lastWallMessageTime: Date.now(),
    };
    if (!nearTop) patch.unreadCount = state.unreadCount + 1;
    update(patch);
    setTimeout(scheduleRender, 8100);
    if (nearTop && feed) {
      requestAnimationFrame(() =>
        feed.scrollTo({ top: 0, behavior: 'smooth' })
      );
    }
  });

  sseOn(es, 'sessions', (data) => {
    update({ sessions: data.rows || [] });
    updateTabTitle();
  });
  sseOn(es, 'tree', (data) => {
    update({ tree: data });
    updateTabTitle();
  });
  sseOn(es, 'stats', (data) => {
    update({ stats: data });
  });
}

async function selectDelegate(sessionId) {
  if (!sessionId) return;
  update({
    selectedDelegate: sessionId,
    activeTab: 'conversation',
    delegateMessages: [],
    delegateHasMore: false,
  });
  workshopEl?.classList.add('open');
  if (!isDesktop()) $('.backdrop')?.classList.add('active');

  try {
    const resp = await fetch(`/api/messages/${sessionId}?limit=100`);
    if (!resp.ok) return;
    const data = await resp.json();
    if (state.selectedDelegate !== sessionId) return; // stale response — user switched delegates
    update({
      delegateMessages: parseMessages(data),
      delegateHasMore: data.has_more || false,
    });
  } catch (err) {
    console.error('[app] Failed to fetch delegate messages:', err);
  }
}

async function loadOlderMessages() {
  const { selectedDelegate: sid, delegateMessages: msgs } = state;
  if (!sid || !msgs.length) return;
  const before = msgs[0].created || msgs[0].created_timestamp;
  if (!before) return;
  try {
    const resp = await fetch(
      `/api/messages/${sid}?limit=100&before=${encodeURIComponent(before)}`
    );
    if (!resp.ok) return;
    const data = await resp.json();
    if (state.selectedDelegate !== sid) return; // stale response — user switched delegates
    update({
      delegateMessages: [...parseMessages(data), ...msgs],
      delegateHasMore: data.has_more || false,
    });
  } catch (err) {
    console.error('[app] Failed to load older messages:', err);
  }
}

function updateTabTitle() {
  if (!state.connected) {
    document.title = 'Goosetown ⚠️ disconnected';
    return;
  }
  const active = state.stats?.sessions?.active || 0;
  const complete = state.stats?.sessions?.complete || 0;
  const total = (state.tree.children || []).length;
  document.title =
    total > 0 && active === 0 && complete === total
      ? 'Goosetown ✅ all done'
      : active > 0
        ? `Goosetown (${active} active)`
        : 'Goosetown';
}

setInterval(() => {
  if (!state.lastWallMessageTime || !state.wallMessages.length) return;
  if (Date.now() - state.lastWallMessageTime >= 10_000) scheduleRender();
}, 5000);

function closeWorkshop() {
  update({
    selectedDelegate: null,
    delegateMessages: [],
    delegateHasMore: false,
  });
  workshopEl?.classList.remove('open');
  $('.backdrop')?.classList.remove('active');
}

function closeOverlays() {
  registryEl?.classList.remove('open');
  workshopEl?.classList.remove('open');
  $('.backdrop')?.classList.remove('active');
}

const clickActions = [
  [
    '.btn-toggle-village[data-action="toggle-village"]',
    () => {
      layoutEl?.classList.toggle('show-village');
      const isNowVisible = layoutEl?.classList.contains('show-village');
      setVillageVisible(isNowVisible);
      update({ villageVisible: isNowVisible || false });
      scheduleRender();
    }
  ],
  [
    '.card[data-session-id]',
    (el) => {
      const sid = el.dataset.sessionId;
      state.selectedDelegate === sid ? closeWorkshop() : selectDelegate(sid);
    },
  ],
  [
    '.bubble-sender[data-sender-id]',
    (el) => {
      const sid = state.tree.sender_map[el.dataset.senderId];
      if (sid) selectDelegate(sid);
    },
  ],
  [
    '.filter-btn[data-filter]',
    (el) => {
      const f = el.dataset.filter;
      if (f === 'all') {
        state.filters.clear();
        update({});
      } else {
        toggleFilter(f);
      }
    },
  ],
  ['.tab[data-tab]', (el) => update({ activeTab: el.dataset.tab })],
  ['.workshop-close', () => closeWorkshop()],
  [
    '.new-messages-pill',
    () => {
      $('.bulletin-feed')?.scrollTo({ top: 0, behavior: 'smooth' });
      update({ unreadCount: 0 });
    },
  ],
  ['.load-older-btn', () => loadOlderMessages()],
  [
    '.hamburger',
    () => {
      const opening = !registryEl?.classList.contains('open');
      registryEl?.classList.toggle('open');
      $('.backdrop')?.classList.toggle('active', opening);
    },
  ],
  ['.backdrop', () => closeOverlays()],
  ['[data-action="wall-post"]', () => {
    state._lastFocusedBeforeDialog = document.activeElement;
    update({ showWallPost: true });
    requestAnimationFrame(() => document.getElementById('wall-post-input')?.focus());
  }],
  ['[data-action="wall-post-send"]', async () => {
    const input = document.getElementById('wall-post-input');
    const msg = input?.value?.trim();
    if (!msg) return;
    try {
      await fetch('/api/wall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
    } catch (e) {
      console.error('[wall-post]', e);
    }
    update({ showWallPost: false });
    state._lastFocusedBeforeDialog?.focus();
    delete state._lastFocusedBeforeDialog;
  }],
  // Dismiss only when clicking the overlay itself or the cancel button — not popup children
  ['[data-action="wall-post-dismiss"]', (el, e) => {
    if (e.target === el || e.target.closest('.wall-post-cancel-btn')) {
      update({ showWallPost: false });
      state._lastFocusedBeforeDialog?.focus();
      delete state._lastFocusedBeforeDialog;
    }
  }],
];

document.addEventListener('click', (e) => {
  for (const [sel, handler] of clickActions) {
    const match = e.target.closest(sel);
    if (match) {
      handler(match, e);
      return;
    }
  }
});

document.addEventListener('change', (e) => {
  if (e.target.dataset.action === 'toggle-chatter') {
    update({ collapseToolChatter: e.target.checked });
  }
});

document.addEventListener('keydown', (e) => {
  // Keyboard activation for role="button" elements (a11y)
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"]')) {
    e.preventDefault();
    e.target.click();
    return;
  }
  if (e.key === 'Escape' && state.showWallPost) {
    update({ showWallPost: false });
    state._lastFocusedBeforeDialog?.focus();
    delete state._lastFocusedBeforeDialog;
  }
  // Focus trap for wall-post dialog
  if (e.key === 'Tab') {
    const overlay = document.querySelector('.wall-post-overlay');
    if (!overlay) return;
    const focusable = overlay.querySelectorAll('textarea, button, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  // Enter (without Shift) in wall post textarea triggers send
  if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'wall-post-input') {
    e.preventDefault();
    document.querySelector('[data-action="wall-post-send"]')?.click();
    return;
  }
  // Arrow key navigation for ARIA tabs
  if (e.target.getAttribute('role') === 'tab') {
    const tabs = [...e.target.parentElement.querySelectorAll('[role="tab"]')];
    const idx = tabs.indexOf(e.target);
    let next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    if (next >= 0) { e.preventDefault(); tabs[next].focus(); tabs[next].click(); }
  }
});

// Capture phase to catch scrollable div events
document.addEventListener(
  'scroll',
  (e) => {
    if (
      e.target.classList?.contains('bulletin-feed') &&
      e.target.scrollTop < 100 &&
      state.unreadCount > 0
    ) {
      update({ unreadCount: 0 });
    }
  },
  true
);

// Listen for custom render events (e.g., from village animations)
document.addEventListener('goosetown-render', () => {
  scheduleRender();
});

// In standalone-village mode the village is always visible — start animation loop
if (document.body.classList.contains('standalone-village')) {
  setVillageVisible(true);
}

connectSSE();
updateTabTitle();
console.log('[Goosetown] Dashboard initialized');
