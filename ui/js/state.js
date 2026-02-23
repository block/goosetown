const state = {
  sessions: [],
  tree: { parent_session_id: null, children: [], sender_map: {} },
  wallMessages: [],
  stats: { wall: {}, sessions: {}, tokens: {} },

  selectedDelegate: null,
  delegateMessages: [],
  delegateHasMore: false,
  activeTab: 'overview',
  filters: new Set(),
  unreadCount: 0,
  connected: false,
  collapseToolChatter: true,
  lastWallMessageTime: null,
  showWallPost: false,
};

const listeners = new Set();

function notify() {
  for (const fn of listeners) {
    try {
      fn(state);
    } catch (e) {
      console.error('[state]', e);
    }
  }
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function update(patch) {
  Object.assign(state, patch);
  notify();
}

function toggleFilter(role) {
  state.filters.has(role)
    ? state.filters.delete(role)
    : state.filters.add(role);
  notify();
}

export { state, subscribe, update, toggleFilter };
