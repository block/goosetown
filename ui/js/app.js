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

const $ = (s) => document.querySelector(s);

const layoutEl = $('.layout');
const registryEl = $('.registry');
const bulletinEl = $('.bulletin');
const workshopEl = $('.workshop');
const clockworksEl = $('.clockworks');
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
  };
}

function parseMessages(data) {
  return (data.messages || []).map((m) => ({
    ...m,
    content:
      typeof m.content_json === 'string'
        ? JSON.parse(m.content_json)
        : m.content_json || [],
  }));
}

function connectSSE() {
  const ps = new URLSearchParams(location.search).get('parent_session');
  const url = ps
    ? `/events?parent_session=${encodeURIComponent(ps)}`
    : '/events';
  const es = new EventSource(url);

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
];

document.addEventListener('click', (e) => {
  for (const [sel, handler] of clickActions) {
    const match = e.target.closest(sel);
    if (match) {
      handler(match);
      return;
    }
  }
});

document.addEventListener('change', (e) => {
  if (e.target.dataset.action === 'toggle-chatter') {
    update({ collapseToolChatter: e.target.checked });
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

connectSSE();
updateTabTitle();
console.log('[Goosetown] Dashboard initialized');
