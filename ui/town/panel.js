/**
 * panel.js — Goose detail panel + wall post form
 *
 * Manages the #goose-panel aside with tabbed interface
 * (Overview / Conversation / Artifacts) and the #wall-post-form.
 */
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.2.4/+esm';
import { Marked } from 'https://cdn.jsdelivr.net/npm/marked@15.0.12/+esm';

const marked = new Marked({ breaks: true, gfm: true });

function md(text) {
  if (!text) return '';
  return DOMPurify.sanitize(marked.parse(text), { USE_PROFILES: { html: true } });
}

const panel        = document.getElementById('goose-panel');
const panelName    = document.getElementById('panel-name');
const panelDot     = document.getElementById('panel-status-dot');
const panelContent = document.getElementById('panel-content');
const panelClose   = document.getElementById('panel-close');
const sendBtn      = document.getElementById('panel-send-to-wall');
const tabBar       = panel.querySelector('.tab-bar');

const wallForm   = document.getElementById('wall-post-form');
const wallInput  = document.getElementById('wall-post-input');
const wallSubmit = document.getElementById('wall-post-submit');
const wallCancel = document.getElementById('wall-post-cancel');

let activeGoose = null;
let activeTab = 'overview';
let parsedMessages = [];
let collapseTools = true;

// ── Helpers ───────────────────────────────────────────────────────────

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

function escapeHtml(s) {
  return s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseContentJson(raw) {
  try {
    const blocks = typeof raw === 'string' ? JSON.parse(raw) : raw || [];
    if (typeof blocks === 'string') return [{ type: 'text', text: blocks }];
    if (Array.isArray(blocks)) return blocks;
    return [];
  } catch {
    return typeof raw === 'string' ? [{ type: 'text', text: raw }] : [];
  }
}

// ── Tab switching ─────────────────────────────────────────────────────

tabBar.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  activeTab = btn.dataset.tab;
  tabBar.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === activeTab));
  renderActiveTab();
});

// ── Panel open / close ────────────────────────────────────────────────

export function openPanel(goose) {
  activeGoose = goose;
  panelName.textContent = goose.gtwall_id || goose.role || goose.id;
  panelDot.className = goose.status || 'idle';
  parsedMessages = [];
  panel.classList.remove('hidden');
  renderActiveTab();

  if (goose.sessionId) {
    fetchMessages(goose.sessionId);
  }
}

export function closePanel() {
  panel.classList.add('hidden');
  activeGoose = null;
}

/** Re-fetch messages for the currently open panel (called on tree updates). */
export function refreshMessages() {
  if (activeGoose?.sessionId) {
    fetchMessages(activeGoose.sessionId);
  }
}

// ── Fetch messages ────────────────────────────────────────────────────

async function fetchMessages(sessionId) {
  try {
    const res = await fetch(`/api/messages/${encodeURIComponent(sessionId)}?limit=200`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    parsedMessages = (data.messages || []).map(m => ({
      ...m,
      content: parseContentJson(m.content_json),
    }));
    renderActiveTab();
  } catch {
    panelContent.innerHTML = '<em class="panel-empty">Failed to load messages.</em>';
  }
}

// ── Render tabs ───────────────────────────────────────────────────────

function renderActiveTab() {
  if (!activeGoose) return;
  switch (activeTab) {
    case 'overview': renderOverview(); break;
    case 'conversation': renderConversation(); break;
    case 'artifacts': renderArtifacts(); break;
  }
}

// ── Overview tab ──────────────────────────────────────────────────────

function renderOverview() {
  const g = activeGoose;
  const rows = [
    ['Role', g.role || 'generic'],
    ['Status', `<span class="dot-inline ${g.status}"></span> ${g.status || 'idle'}`],
    ['Tokens', formatTokens(g.tokens ?? 0)],
    ['Messages', String(g.messageCount ?? 0)],
    ['State', g.state || 'idle'],
  ];
  if (g.inPen) rows.push(['Location', 'Off Duty pen']);

  panelContent.innerHTML = `
    <div class="overview-grid">
      ${rows.map(([label, val]) => `
        <div class="overview-row">
          <span class="overview-label">${label}</span>
          <span class="overview-value">${val}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Conversation tab ──────────────────────────────────────────────────

function renderConversation() {
  if (!parsedMessages.length) {
    panelContent.innerHTML = '<em class="panel-empty">No messages yet.</em>';
    return;
  }

  let html = '<div class="conversation-feed">';
  for (const msg of parsedMessages) {
    for (const block of msg.content) {
      if (block.type === 'text' && block.text?.trim()) {
        const cls = msg.role === 'user' ? 'msg-user' : 'msg-assistant';
        html += `<div class="msg-bubble ${cls}">${md(block.text)}</div>`;
      } else if (block.type === 'tool_use' || block.type === 'toolRequest') {
        if (collapseTools) continue;
        const name = block.name || block.toolCall?.value?.name || 'tool';
        const args = block.input || block.toolCall?.value?.arguments || {};
        html += `
          <details class="tool-request">
            <summary>🔧 ${escapeHtml(name)}</summary>
            <pre class="tool-args">${escapeHtml(JSON.stringify(args, null, 2))}</pre>
          </details>`;
      } else if (block.type === 'tool_result' || block.type === 'toolResponse') {
        if (collapseTools) continue;
        const text = block.content?.[0]?.text || block.toolResult?.value?.content?.[0]?.text || '';
        if (!text) continue;
        html += `<div class="tool-response"><pre>${escapeHtml(text.slice(0, 2000))}${text.length > 2000 ? '…' : ''}</pre></div>`;
      }
    }
  }
  html += '</div>';

  html += `
    <div class="conversation-controls">
      <label class="tool-toggle">
        <input type="checkbox" id="collapse-tools" ${collapseTools ? 'checked' : ''} />
        Collapse tool chatter
      </label>
    </div>`;

  panelContent.innerHTML = html;
  const feed = panelContent.querySelector('.conversation-feed');
  if (feed) feed.scrollTop = feed.scrollHeight;

  document.getElementById('collapse-tools')?.addEventListener('change', (e) => {
    collapseTools = e.target.checked;
    renderConversation();
  });
}

// ── Artifacts tab ─────────────────────────────────────────────────────

const ARTIFACT_TOOLS = new Set([
  'developer__text_editor', 'text_editor', 'Write', 'Edit',
  'developer__shell', 'Bash',
]);

function renderArtifacts() {
  const artifacts = [];
  for (const msg of parsedMessages) {
    for (const block of msg.content) {
      if (block.type !== 'tool_use' && block.type !== 'toolRequest') continue;
      const name = block.name || block.toolCall?.value?.name || '';
      if (!ARTIFACT_TOOLS.has(name)) continue;
      const args = block.input || block.toolCall?.value?.arguments || {};
      if (name.includes('text_editor') || name === 'Write' || name === 'Edit') {
        artifacts.push({ type: 'file', path: args.path || args.file_path || 'unknown', command: args.command || 'edit' });
      } else {
        artifacts.push({ type: 'shell', command: args.command || '' });
      }
    }
  }

  if (!artifacts.length) {
    panelContent.innerHTML = '<em class="panel-empty">No artifacts found.</em>';
    return;
  }

  panelContent.innerHTML = `
    <div class="artifacts-list">
      ${artifacts.map(a => a.type === 'file'
        ? `<div class="artifact-item artifact-file">
            <span class="artifact-icon">📄</span>
            <span class="artifact-path">${escapeHtml(a.path)}</span>
            <span class="artifact-action">${escapeHtml(a.command)}</span>
           </div>`
        : `<div class="artifact-item artifact-shell">
            <span class="artifact-icon">💻</span>
            <pre class="artifact-cmd">${escapeHtml(a.command)}</pre>
           </div>`
      ).join('')}
    </div>`;
}

// ── Send to wall ──────────────────────────────────────────────────────

sendBtn.addEventListener('click', async () => {
  if (!activeGoose) return;
  const gtwallId = activeGoose.gtwall_id || activeGoose.id;
  try {
    await fetch('/api/wall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_id: 'human',
        message: `@${gtwallId}: READ GTWALL NOW`,
      }),
    });
    activeGoose.goRead();
  } catch (_) {
    // silent
  }
});

panelClose.addEventListener('click', closePanel);

// ── Wall Post Form ────────────────────────────────────────────────────

export function showWallForm() {
  wallForm.classList.remove('hidden');
  wallInput.value = '';
  wallInput.focus();
}

export function hideWallForm() {
  wallForm.classList.add('hidden');
}

wallCancel.addEventListener('click', hideWallForm);

wallSubmit.addEventListener('click', async () => {
  const message = wallInput.value.trim();
  if (!message) return;
  try {
    await fetch('/api/wall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender_id: 'human', message }),
    });
  } catch (_) {
    // silent
  }
  hideWallForm();
});

wallInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    wallSubmit.click();
  }
});

// ── File Reader Panel ────────────────────────────────────────────────────

const fileModal = document.getElementById('file-modal');
const filePanelName = document.getElementById('file-panel-name');
const filePanelContent = document.getElementById('file-panel-content');
const filePanelClose = document.getElementById('file-panel-close');

export async function openFilePanel(filePath, filename) {
  filePanelName.textContent = filename;
  filePanelContent.innerHTML = '<em class="panel-empty">Loading...</em>';
  fileModal.classList.remove('hidden');

  try {
    const res = await fetch(`/api/files/${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    const content = data.content || '';
    if (filename.endsWith('.md')) {
      filePanelContent.innerHTML = `<div class="file-content">${md(content)}</div>`;
    } else {
      filePanelContent.innerHTML = `<pre class="file-content-pre">${escapeHtml(content)}</pre>`;
    }
  } catch {
    filePanelContent.innerHTML = '<em class="panel-empty">Failed to load file.</em>';
  }
}

export function closeFilePanel() {
  fileModal.classList.add('hidden');
}

filePanelClose.addEventListener('click', closeFilePanel);

// Click backdrop to close
fileModal.addEventListener('click', (e) => {
  if (e.target === fileModal) closeFilePanel();
});

// ── Desk Browser Panel ────────────────────────────────────────────────

const deskPanel = document.getElementById('desk-panel');
const deskPanelContent = document.getElementById('desk-panel-content');
const deskPanelClose = document.getElementById('desk-panel-close');

export function openDeskBrowser(files) {
  closeFilePanel();
  if (!files.length) {
    deskPanelContent.innerHTML = '<em class="panel-empty">No documents yet.</em>';
  } else {
    // Group by directory
    const groups = {};
    for (const f of files) {
      const dir = f.path.includes('/') ? f.path.split('/').slice(0, -1).join('/') : '.';
      (groups[dir] ||= []).push(f);
    }
    let html = '';
    for (const [dir, items] of Object.entries(groups).sort()) {
      html += `<div class="desk-group"><div class="desk-group-label">${escapeHtml(dir)}/</div>`;
      for (const f of items) {
        html += `<button class="desk-file-btn" data-path="${escapeHtml(f.path)}" data-name="${escapeHtml(f.filename)}">${escapeHtml(f.filename)}</button>`;
      }
      html += '</div>';
    }
    deskPanelContent.innerHTML = html;
  }
  deskPanel.classList.remove('hidden');
}

export function closeDeskBrowser() {
  deskPanel.classList.add('hidden');
}

deskPanelClose.addEventListener('click', closeDeskBrowser);

deskPanelContent.addEventListener('click', (e) => {
  const btn = e.target.closest('.desk-file-btn');
  if (!btn) return;
  openFilePanel(btn.dataset.path, btn.dataset.name);
});
