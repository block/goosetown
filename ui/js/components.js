// CDN dependencies are pinned to exact versions for supply-chain safety.
// To update: check https://www.npmjs.com/package/PACKAGE for latest version.
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.2.4/+esm';
import { html } from 'https://cdn.jsdelivr.net/npm/lit-html@3.3.2/+esm';
import { unsafeHTML } from 'https://cdn.jsdelivr.net/npm/lit-html@3.3.2/directives/unsafe-html.js/+esm';
import { Marked } from 'https://cdn.jsdelivr.net/npm/marked@15.0.12/+esm';
import { inferRole } from './buildings.js';

// ─── Markdown ────────────────────────────────────────────────────────
const marked = new Marked({ breaks: true, gfm: true });

function renderMarkdown(text) {
  if (!text) return '';
  // SECURITY: Sanitize HTML output to prevent XSS via unsafeHTML()
  // USE_PROFILES restricts to HTML only (no SVG/MathML attack surface)
  return DOMPurify.sanitize(marked.parse(text), {
    USE_PROFILES: { html: true },
  });
}

// ─── Constants ───────────────────────────────────────────────────────

const AVATARS = {
  orchestrator: '🎩',
  researcher: '🔍',
  worker: '🔧',
  reviewer: '📋',
  writer: '✍️',
  generic: '🪿',
};

const FILTER_ROLES = [
  { key: 'orchestrator', label: '🎩 Orchestrator' },
  { key: 'researcher', label: '🔍 Researchers' },
  { key: 'worker', label: '🔧 Workers' },
  { key: 'reviewer', label: '📋 Reviewers' },
  { key: 'writer', label: '✍️ Writers' },
  { key: 'generic', label: '🪿 Generic' },
];

function formatTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function inferMessageType(msg) {
  if (!msg) return 'note';
  const t = msg.trimStart();
  if (t.startsWith('🎬')) return 'start';
  if (t.startsWith('💡')) return 'discovery';
  if (t.startsWith('✅')) return 'done';
  if (t.startsWith('⚠️')) return 'warning';
  if (t.startsWith('⏰') || t.startsWith('🚨')) return 'signal';
  return 'note';
}

const avatar = (role) => AVATARS[role] || AVATARS.generic;
const lantern = (status) =>
  html`<span class="lantern lantern-${status || 'idle'}" role="img" aria-label="${status || 'idle'} status"></span>`;
const delegateRole = (d) => inferRole(d.role || d.id);
const delegateName = (d) => d.gtwall_id || d.role || d.id;

function senderRole(senderId, st) {
  if (senderId === 'orchestrator' || senderId === st.tree.parent_session_id) {
    return 'orchestrator';
  }
  const sessionId = st.tree.sender_map[senderId];
  if (!sessionId) return 'generic';
  const child = st.tree.children.find((c) => c.id === sessionId);
  return child ? inferRole(child.role || child.id) : 'generic';
}

function findDelegate(sessionId, st) {
  if (sessionId === st.tree.parent_session_id) {
    const s = st.sessions.find((x) => x.id === sessionId);
    if (s) return { ...s, role: 'orchestrator' };
  }
  return (
    st.tree.children.find((c) => c.id === sessionId) ||
    st.sessions.find((x) => x.id === sessionId) ||
    null
  );
}

// ─── Registry ────────────────────────────────────────────────────────

function delegateCard(delegate, selected) {
  const role = delegateRole(delegate);
  const cls = `card role-${role}${selected === delegate.id ? ' selected' : ''}`;
  const elapsed =
    delegate.elapsed_seconds != null
      ? formatElapsed(delegate.elapsed_seconds)
      : '';

  return html`
    <div class=${cls} tabindex="0" role="button" data-session-id=${delegate.id}>
      ${lantern(delegate.status)}
      <div class="card-header">
        <span class="card-avatar">${avatar(role)}</span>
        <span class="card-name">${delegateName(delegate)}</span>
      </div>
      <div class="card-stats">
        <span class="card-status">${delegate.status || 'idle'}</span>
        <span class="card-tokens">${formatTokens(delegate.tokens)} tok</span>
      </div>
      <div class="card-meta">
        ${elapsed ? html`<span class="card-elapsed">${elapsed}</span>` : ''}
        ${
          delegate.message_count != null
            ? html`<span class="card-msgs">${delegate.message_count} msgs</span>`
            : ''
        }
      </div>
    </div>
  `;
}

function renderRegistry(st) {
  const { children = [] } = st.tree;
  const parentId = st.tree.parent_session_id;
  const orch = st.sessions.find((s) => s.id === parentId);
  const orchCard = parentId
    ? {
        id: parentId,
        role: 'orchestrator',
        status: orch?.status || 'active',
        tokens: orch?.accumulated_total_tokens || orch?.tokens || 0,
        message_count: orch?.message_count,
        elapsed_seconds: orch?.elapsed_seconds,
      }
    : null;

  return html`
    <div class="registry-header"><h2>Registry</h2></div>
    ${orchCard ? delegateCard(orchCard, st.selectedDelegate) : ''}
    ${orchCard ? html`<div class="registry-divider"></div>` : ''}
    ${
      children.length > 0
        ? [...children]
            .reverse()
            .map((c) => delegateCard(c, st.selectedDelegate))
        : html`<div class="registry-empty">
          ${
            parentId
              ? html`<span class="gear-spinner">⚙</span> Spawning delegates…`
              : 'Waiting for session…'
          }
        </div>`
    }
  `;
}

// ─── Bulletin ────────────────────────────────────────────────────────

function wallMessage(msg, st, isNew = false) {
  const type = inferMessageType(msg.message);
  const role = senderRole(msg.sender_id, st);
  const cls = `bubble bubble-${type} role-${role}${isNew ? ' message-new' : ''}`;

  return html`
    <div class=${cls}>
      <div class="bubble-header">
        <span class="bubble-sender" role="button" tabindex="0" data-sender-id=${msg.sender_id}>
          ${avatar(role)} ${msg.sender_id}
        </span>
        <span class="bubble-time">${msg.time}</span>
      </div>
      <div class="bubble-text">${msg.message}</div>
    </div>
  `;
}

function renderBulletin(st) {
  const { filters } = st;
  const messages = st.wallMessages || [];
  const filtered =
    filters.size === 0
      ? messages
      : messages.filter((m) => filters.has(senderRole(m.sender_id, st)));

  const now = Date.now();
  const quietSec = st.lastWallMessageTime
    ? Math.floor((now - st.lastWallMessageTime) / 1000)
    : null;
  const showQuiet = quietSec != null && quietSec >= 10 && messages.length > 0;

  return html`
    <div class="bulletin-header">
      <h2>Goosetown</h2>
      ${lantern(st.connected ? 'active' : 'error')}
      <span style="flex:1"></span>
      <button class="btn-toggle-village" data-action="toggle-village" aria-expanded="${st.villageVisible ? 'true' : 'false'}">Village</button>
      <a href="/ui/village.html" target="_blank" rel="noopener noreferrer" class="btn-toggle-village" style="text-decoration: none;" title="Open fullscreen village" aria-label="Open fullscreen village">⛶</a>
      <button class="btn-toggle-village" data-action="wall-post" title="Post to wall" aria-label="Post message to wall">📝</button>
    </div>
    <div class="filter-bar">
      <button class="filter-btn ${filters.size === 0 ? 'active' : ''}"
              aria-pressed="${filters.size === 0 ? 'true' : 'false'}"
              data-filter="all">All</button>
      ${FILTER_ROLES.map(
        (r) => html`
        <button class="filter-btn ${filters.has(r.key) ? 'active' : ''}"
                aria-pressed="${filters.has(r.key) ? 'true' : 'false'}"
                data-filter=${r.key}>${r.label}</button>
      `
      )}
    </div>
    <div class="bulletin-feed" role="log" aria-live="polite" aria-relevant="additions">
      ${
        filtered.length === 0
          ? html`<div class="bulletin-empty">
            ${
              messages.length === 0
                ? 'Waiting for wall… (start a goose session or check GOOSE_GTWALL_FILE)'
                : 'No messages match current filters.'
            }
          </div>`
          : [...filtered]
              .reverse()
              .map((msg) => wallMessage(msg, st, msg._isNew))
      }
      ${
        showQuiet
          ? html`<div class="quiet-moment">Quiet moment… last message ${quietSec}s ago</div>`
          : ''
      }
    </div>
    ${
      st.unreadCount > 0
        ? html`<button class="new-messages-pill" data-action="scroll-to-new">↑ ${st.unreadCount} new message${st.unreadCount > 1 ? 's' : ''}</button>`
        : ''
    }
    ${st.showWallPost ? html`
      <div class="wall-post-overlay" role="dialog" aria-modal="true" aria-label="Post message to wall" data-action="wall-post-dismiss">
        <div class="wall-post-popup">
          <div class="wall-post-header">Post to Wall</div>
          <textarea class="wall-post-input" id="wall-post-input" aria-label="Wall message"
                    placeholder="Type your message..." rows="3"></textarea>
          <div class="wall-post-actions">
            <button data-action="wall-post-send">Send</button>
            <button class="wall-post-cancel-btn" data-action="wall-post-dismiss">Cancel</button>
          </div>
        </div>
      </div>
    ` : ''}
  `;
}

// ─── Workshop ────────────────────────────────────────────────────────

function overviewTab(delegate) {
  const role = delegateRole(delegate);

  const row = (label, value) => html`
    <div class="overview-item">
      <span class="overview-label">${label}</span>
      <span class="overview-value">${value}</span>
    </div>
  `;

  return html`
    <div class="overview-grid">
      ${row('Role', html`<span class="badge role-${role}">${avatar(role)} ${role}</span>`)}
      ${row('Status', html`${lantern(delegate.status)} ${delegate.status}`)}
      ${row('Model', delegate.model || 'unknown')}
      ${row('Tokens', formatTokens(delegate.tokens))}
      ${row('Messages', delegate.message_count ?? '—')}
      ${
        delegate.elapsed_seconds != null
          ? row('Elapsed', formatElapsed(delegate.elapsed_seconds))
          : ''
      }
    </div>
  `;
}

const CONTENT_RENDERERS = {
  text(item, msg) {
    const cls = msg.role === 'user' ? 'msg-user' : 'msg-assistant';
    return html`<div class="msg-bubble markdown-body ${cls}">${unsafeHTML(renderMarkdown(item.text))}</div>`;
  },
  toolRequest(item, _msg, collapsed) {
    if (collapsed) return html``;
    const toolName = item.toolCall?.value?.name || 'unknown';
    const args = item.toolCall?.value?.arguments || {};
    return html`
      <details class="tool-request">
        <summary>🔧 ${toolName}</summary>
        <pre class="tool-args">${JSON.stringify(args, null, 2)}</pre>
      </details>
    `;
  },
  toolResponse(item, _msg, collapsed) {
    if (collapsed) return html``;
    const text = item.toolResult?.value?.content?.[0]?.text || '';
    const isError = item.toolResult?.value?.isError || false;
    return html`
      <div class="tool-response ${isError ? 'tool-error' : ''}">
        <pre>${text.slice(0, 2000)}${text.length > 2000 ? '…' : ''}</pre>
      </div>
    `;
  },
  systemNotification(item) {
    return html`<div class="msg-system">${item.msg}</div>`;
  },
};

function conversationMessage(msg, collapsed) {
  return html`${(msg.content || []).map((item) => {
    const renderer = CONTENT_RENDERERS[item.type];
    return renderer ? renderer(item, msg, collapsed) : html``;
  })}`;
}

function conversationTab(messages, collapsed, hasMore) {
  return html`
    ${
      hasMore
        ? html`<button class="load-older-btn" data-action="load-older">Load older…</button>`
        : ''
    }
    <div class="conversation-feed">
      ${messages.map((msg) => conversationMessage(msg, collapsed))}
      ${
        messages.length === 0
          ? html`<div class="conversation-empty">No messages yet.</div>`
          : ''
      }
    </div>
    <div class="conversation-controls">
      <label class="tool-chatter-toggle">
        <input type="checkbox" ?checked=${collapsed} data-action="toggle-chatter" />
        Collapse tool chatter
      </label>
    </div>
  `;
}

const ARTIFACT_TOOLS = {
  developer__text_editor: (args) => ({
    type: 'file',
    path: args.path || 'unknown',
    command: args.command || 'edit',
  }),
  developer__shell: (args) => ({ type: 'shell', command: args.command || '' }),
};

function artifactsTab(messages) {
  const artifacts = messages.flatMap((msg) =>
    (msg.content || [])
      .filter((item) => item.type === 'toolRequest')
      .map((item) => {
        const tc = item.toolCall?.value || {};
        const extract = ARTIFACT_TOOLS[tc.name];
        return extract ? extract(tc.arguments || {}) : null;
      })
      .filter(Boolean)
  );

  if (!artifacts.length) {
    return html`<div class="artifacts-empty">No artifacts found.</div>`;
  }

  return html`
    <div class="artifacts-list">
      ${artifacts.map(
        (a) => html`
        <div class="artifact-item artifact-${a.type}">
          ${
            a.type === 'file'
              ? html`<span class="artifact-icon">📄</span>
                   <span class="artifact-path">${a.path}</span>
                   <span class="artifact-action">${a.command}</span>`
              : html`<span class="artifact-icon">💻</span>
                   <pre class="artifact-cmd">${a.command}</pre>`
          }
        </div>
      `
      )}
    </div>
  `;
}

function renderWorkshop(st) {
  const delegate = st.selectedDelegate
    ? findDelegate(st.selectedDelegate, st)
    : null;

  if (!delegate) {
    return html`<div class="workshop-empty">
      Select a citizen in the Registry to visit their workshop.
    </div>`;
  }

  const role = delegateRole(delegate);
  const tabs = ['overview', 'conversation', 'artifacts'];

  return html`
    <div class="workshop-header">
      <div class="workshop-title">
        <span class="card-avatar">${avatar(role)}</span>
        <span class="workshop-name">${delegateName(delegate)}</span>
      </div>
      <button class="workshop-close" data-action="close-workshop" aria-label="Close workshop panel">×</button>
    </div>
    <div class="workshop-status">
      <span class="badge role-${role}">${role}</span>
      ${lantern(delegate.status)}
      ${
        delegate.elapsed_seconds != null
          ? html`<span class="workshop-elapsed">${formatElapsed(delegate.elapsed_seconds)}</span>`
          : ''
      }
      <span class="workshop-tokens">${formatTokens(delegate.tokens)} tok</span>
    </div>
    <div class="tab-bar" role="tablist">
      ${tabs.map(
        (tab) => html`
        <button class="tab ${st.activeTab === tab ? 'active' : ''}"
                id="tab-${tab}"
                role="tab" aria-selected="${st.activeTab === tab ? 'true' : 'false'}"
                tabindex="${st.activeTab === tab ? '0' : '-1'}"
                data-tab=${tab}>${tab[0].toUpperCase() + tab.slice(1)}</button>
      `
      )}
    </div>
    <div class="workshop-content" role="tabpanel" aria-labelledby="tab-${st.activeTab}">
      ${(
        {
          overview: () => overviewTab(delegate),
          conversation: () =>
            conversationTab(
              st.delegateMessages,
              st.collapseToolChatter,
              st.delegateHasMore
            ),
          artifacts: () => artifactsTab(st.delegateMessages),
        }[st.activeTab] || (() => '')
      )()}
    </div>
  `;
}

// ─── Clockworks ──────────────────────────────────────────────────────

function renderClockworks(st) {
  const { sessions = {}, wall = {}, tokens = {} } = st.stats || {};
  const total = (st.tree.children || []).length;
  const active = sessions.active || 0;

  return html`
    <div class="clockworks-inner">
      <span class="clockworks-stat">
        <span class="${active > 0 ? 'gear-spinner' : ''}">⚙</span>
        ${total} delegate${total !== 1 ? 's' : ''}
      </span>
      <span class="clockworks-divider">│</span>
      <span class="clockworks-stat">● ${active} active</span>
      <span class="clockworks-divider">│</span>
      <span class="clockworks-stat">📊 ${formatTokens(tokens.accumulated_total || 0)} tok</span>
      <span class="clockworks-divider">│</span>
      <span class="clockworks-stat">📝 ${wall.rate_per_min || 0} msg/min</span>
      <span class="clockworks-divider">│</span>
      <span class="clockworks-stat connection-indicator ${st.connected ? 'connected' : 'disconnected'}">
        🔌 ${st.connected ? 'connected' : 'disconnected'}
      </span>
    </div>
  `;
}

// ─── Exports ─────────────────────────────────────────────────────────

export { renderRegistry, renderBulletin, renderWorkshop, renderClockworks };
