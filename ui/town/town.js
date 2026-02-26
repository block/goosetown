/**
 * town.js — Main 3D scene, SSE consumer, goose lifecycle, raycasting
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Goose } from './goose.js';
import { openPanel, closePanel, refreshMessages, showWallForm, hideWallForm, openFilePanel, closeFilePanel, openDeskBrowser, closeDeskBrowser } from './panel.js';

// ── Scene setup ─────────────────────────────────────────────────────────
const canvas = document.getElementById('town-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);  // sky blue
scene.fog = new THREE.Fog(0x87ceeb, 30, 60);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 12, 14);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minPolarAngle = 0.2;
controls.maxPolarAngle = Math.PI / 2 - 0.05;

// ── Lighting ────────────────────────────────────────────────────────────
scene.add(new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.8));
scene.add(new THREE.AmbientLight(0xffffff, 0.4));

// Sun
const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.2);
sunLight.position.set(5, 12, 8);
scene.add(sunLight);

const fillLight = new THREE.PointLight(0xffd9a0, 0.6, 40);
fillLight.position.set(-6, 6, 4);
scene.add(fillLight);

// ── Ground ──────────────────────────────────────────────────────────────
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(15, 48),
  new THREE.MeshLambertMaterial({ color: 0x4a7c3f })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ── Bulletin board ──────────────────────────────────────────────────────
const boardPosition = new THREE.Vector3(0, 0, -2);

const frame = new THREE.Mesh(
  new THREE.BoxGeometry(5.0, 2.5, 0.15),
  new THREE.MeshLambertMaterial({ color: 0x3d2000 })
);
frame.position.set(0, 1.5, -2);
scene.add(frame);

const face = new THREE.Mesh(
  new THREE.BoxGeometry(4.6, 2.1, 0.05),
  new THREE.MeshLambertMaterial({ color: 0xf5e6c8 })
);
face.position.set(0, 1.5, -1.87);
scene.add(face);

// Board text — CanvasTexture for last 6 wall messages
const boardCanvas = document.createElement('canvas');
boardCanvas.width = 720;
boardCanvas.height = 360;
const boardCtx = boardCanvas.getContext('2d');
const boardTexture = new THREE.CanvasTexture(boardCanvas);
const boardTextMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(4.4, 2.0),
  new THREE.MeshBasicMaterial({ map: boardTexture, transparent: true })
);
boardTextMesh.position.set(0, 1.5, -1.84);
scene.add(boardTextMesh);

const recentWallMessages = [];
const seenWallKeys = new Set();

function wallMsgKey(m) {
  return `${m.timestamp || ''}:${m.sender_id || ''}:${m.message || ''}`;
}

function updateBoardTexture(wallMsg) {
  const key = wallMsgKey(wallMsg);
  if (seenWallKeys.has(key)) return;
  seenWallKeys.add(key);
  recentWallMessages.push(wallMsg);
  if (recentWallMessages.length > 6) recentWallMessages.shift();
  redrawBoard();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function redrawBoard() {
  boardCtx.clearRect(0, 0, 720, 360);
  boardCtx.font = 'bold 18px monospace';
  boardCtx.fillStyle = '#1a0f00';
  const maxWidth = 696; // 720 - 12px padding each side
  const lineHeight = 18;
  const msgGap = 8;
  let y = 24;
  for (let i = 0; i < recentWallMessages.length; i++) {
    const m = recentWallMessages[i];
    const sender = m.sender_id || '???';
    const text = m.message || '';
    const line = `${sender}: ${text}`;
    const wrapped = wrapText(boardCtx, line, maxWidth);
    // Cap at 3 lines per message to keep space for others
    const maxLines = 3;
    for (let j = 0; j < Math.min(wrapped.length, maxLines); j++) {
      let display = wrapped[j];
      if (j === maxLines - 1 && wrapped.length > maxLines) display += '…';
      boardCtx.fillText(display, 12, y);
      y += lineHeight;
    }
    y += msgGap;
    if (y > 360) break;
  }
  boardTexture.needsUpdate = true;
}

// ── Retirement pen ─────────────────────────────────────────────────────
const penBounds = { xMin: -3, xMax: 3, zMin: -12, zMax: -8 };
const penCenter = new THREE.Vector3(0, 0, -10);

// Ground patch (hay-colored)
const penGround = new THREE.Mesh(
  new THREE.PlaneGeometry(6, 4),
  new THREE.MeshLambertMaterial({ color: 0xc8b560 })
);
penGround.rotation.x = -Math.PI / 2;
penGround.position.set(0, 0.01, -10);
scene.add(penGround);

// Fence rails
const fenceMat = new THREE.MeshLambertMaterial({ color: 0x6b3a1f });
const fenceRails = [
  // front (closest to board)
  { size: [6.2, 0.12, 0.08], pos: [0, 0.45, -7.9] },
  { size: [6.2, 0.12, 0.08], pos: [0, 0.25, -7.9] },
  // back
  { size: [6.2, 0.12, 0.08], pos: [0, 0.45, -12.1] },
  { size: [6.2, 0.12, 0.08], pos: [0, 0.25, -12.1] },
  // left
  { size: [0.08, 0.12, 4.2], pos: [-3.1, 0.45, -10] },
  { size: [0.08, 0.12, 4.2], pos: [-3.1, 0.25, -10] },
  // right
  { size: [0.08, 0.12, 4.2], pos: [3.1, 0.45, -10] },
  { size: [0.08, 0.12, 4.2], pos: [3.1, 0.25, -10] },
];
// Fence posts at corners
const postPositions = [[-3.1, -7.9], [3.1, -7.9], [-3.1, -12.1], [3.1, -12.1]];
postPositions.forEach(([x, z]) => {
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), fenceMat);
  post.position.set(x, 0.35, z);
  scene.add(post);
});
fenceRails.forEach(({ size, pos }) => {
  const rail = new THREE.Mesh(new THREE.BoxGeometry(...size), fenceMat);
  rail.position.set(...pos);
  scene.add(rail);
});

// "Off Duty" sign
const signCanvas = document.createElement('canvas');
signCanvas.width = 256; signCanvas.height = 64;
const signCtx = signCanvas.getContext('2d');
signCtx.fillStyle = '#f5e6c8';
signCtx.fillRect(0, 0, 256, 64);
signCtx.strokeStyle = '#3d2000';
signCtx.lineWidth = 3;
signCtx.strokeRect(2, 2, 252, 60);
signCtx.font = 'bold 28px monospace';
signCtx.fillStyle = '#3d2000';
signCtx.textAlign = 'center';
signCtx.fillText('Off Duty', 128, 42);
const signTex = new THREE.CanvasTexture(signCanvas);
const signMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(1.4, 0.35),
  new THREE.MeshBasicMaterial({ map: signTex })
);
signMesh.position.set(0, 0.75, -7.85);
scene.add(signMesh);
// Sign post
const signPost = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), fenceMat);
signPost.position.set(0, 0.45, -7.9);
scene.add(signPost);

// ── Desk ─────────────────────────────────────────────────────────────────
const deskPosition = new THREE.Vector3(5, 0.4, -2);
const deskMat = new THREE.MeshLambertMaterial({ color: 0x3d2000 });

// Table top
const deskTop = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 1.2), deskMat);
deskTop.position.set(5, 0.8, -2);
scene.add(deskTop);

// 4 legs
[[-0.85, -0.45], [0.85, -0.45], [-0.85, 0.45], [0.85, 0.45]].forEach(([dx, dz]) => {
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), deskMat);
  leg.position.set(5 + dx, 0.4, -2 + dz);
  scene.add(leg);
});

// "Documents" sign
const docSignCanvas = document.createElement('canvas');
docSignCanvas.width = 256; docSignCanvas.height = 64;
const docSignCtx = docSignCanvas.getContext('2d');
docSignCtx.fillStyle = '#f5e6c8';
docSignCtx.fillRect(0, 0, 256, 64);
docSignCtx.strokeStyle = '#3d2000';
docSignCtx.lineWidth = 3;
docSignCtx.strokeRect(2, 2, 252, 60);
docSignCtx.font = 'bold 24px monospace';
docSignCtx.fillStyle = '#3d2000';
docSignCtx.textAlign = 'center';
docSignCtx.fillText('Documents', 128, 42);
const docSignTex = new THREE.CanvasTexture(docSignCanvas);
const docSignMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(1.2, 0.3),
  new THREE.MeshBasicMaterial({ map: docSignTex })
);
docSignMesh.position.set(5, 1.05, -1.38);
scene.add(docSignMesh);

// ── Notes on desk ────────────────────────────────────────────────────────
const notes = new Map(); // path → { mesh, path, filename, stackIndex }
let noteStackIndex = 0;

function createNoteMesh(filename) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f5f5f0';
  ctx.fillRect(0, 0, 256, 128);
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  // Truncate long filenames
  const display = filename.length > 20 ? filename.slice(0, 18) + '..' : filename;
  ctx.fillText(display, 128, 70);
  const tex = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.01, 0.45),
    new THREE.MeshLambertMaterial({ map: tex, color: 0xf5f5f0 })
  );
  mesh.userData.isNote = true;
  return mesh;
}

function addNoteToDesk(noteMesh, path, filename) {
  const idx = noteStackIndex++;
  noteMesh.position.set(
    5 + (Math.random() - 0.5) * 0.6,
    0.85 + idx * 0.015,
    -2 + (Math.random() - 0.5) * 0.4
  );
  noteMesh.rotation.y = (Math.random() - 0.5) * 0.4;
  scene.add(noteMesh);
  notes.set(path, { mesh: noteMesh, path, filename, stackIndex: idx });
  noteMesh.userData.filePath = path;
  noteMesh.userData.fileName = filename;
}

function removeNote(path) {
  const note = notes.get(path);
  if (note) {
    scene.remove(note.mesh);
    notes.delete(path);
  }
}

function clearAllNotes() {
  notes.forEach(n => scene.remove(n.mesh));
  notes.clear();
  noteStackIndex = 0;
}

function onFileCreated(data) {
  if (notes.has(data.path)) return;
  const noteMesh = createNoteMesh(data.filename);
  // Find creator goose or first active goose
  const goose = geese.get(data.creator) || [...geese.values()].find(g => g.status === 'active');
  if (goose && goose.state === 'idle') {
    goose.carryNote(noteMesh);
    goose.goDeliverNote(deskPosition, () => addNoteToDesk(noteMesh, data.path, data.filename));
  } else {
    addNoteToDesk(noteMesh, data.path, data.filename);
  }
}

// ── Context menu ─────────────────────────────────────────────────────────
const contextMenu = document.getElementById('context-menu');
let contextTarget = null;

function showContextMenu(x, y, note) {
  contextTarget = note;
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  contextMenu.classList.remove('hidden');
}

function hideContextMenu() {
  contextMenu.classList.add('hidden');
  contextTarget = null;
}

contextMenu.addEventListener('click', async (e) => {
  const action = e.target.dataset.action;
  if (!action || !contextTarget) return;
  const { filePath, fileName } = contextTarget;
  if (action === 'open') {
    openFilePanel(filePath, fileName);
  } else if (action === 'delete') {
    try {
      await fetch(`/api/files/${encodeURIComponent(filePath)}`, { method: 'DELETE' });
    } catch (_) {}
  }
  hideContextMenu();
});

document.addEventListener('click', () => hideContextMenu());

renderer.domElement.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const noteMeshes = [...notes.values()].map(n => n.mesh);
  const hits = raycaster.intersectObjects(noteMeshes);
  if (hits.length > 0) {
    showContextMenu(e.clientX, e.clientY, hits[0].object.userData);
  }
});

// ── Goose management ────────────────────────────────────────────────────
let launchRunning = false;  // true while the orchestrator OS process is alive
const geese = new Map();  // gtwall_id → Goose

function onTree(tree) {
  const children = tree.children || [];
  console.log(`[Town] onTree: ${children.length} children`, children.map(c => ({key: c.gtwall_id || c.id, role: c.role, status: c.status})));
  children.forEach((child, i) => {
    const key = child.gtwall_id || child.id;
    if (!key) return;
    if (!geese.has(key)) {
      const goose = new Goose({
        id: child.id,
        role: child.role || 'generic',
        gtwall_id: key,
        scene,
        boardPosition,
      });
      // Place on ring — orchestrator at center, others on ring radius 6
      if (child.role === 'orchestrator') {
        goose.setHome(new THREE.Vector3(0, 0.1, 0));
      } else {
        const total = Math.max(children.length - 1, 1);
        const idx = geese.size;
        const angle = (idx / total) * Math.PI * 2;
        goose.setHome(new THREE.Vector3(Math.sin(angle) * 6, 0, Math.cos(angle) * 6));
      }
      geese.set(key, goose);
      // If already complete on first sight (e.g. page reload), go straight to pen
      const skipPen = child.role === 'orchestrator' && launchRunning;
      if (child.status === 'complete' && !skipPen) {
        goose.updateFromTree(child);
        goose.sendToPen(penCenter, penBounds);
        // Place directly in pen (no walk animation on load)
        goose.mesh.position.copy(goose.homePosition);
      }

    } else {
      const goose = geese.get(key);
      goose.updateFromTree(child);
      const skipPen = goose.role === 'orchestrator' && launchRunning;
      if (goose.status === 'complete' && !goose.inPen && !skipPen) {
        goose.sendToPen(penCenter, penBounds);
      }
    }
  });

  // Refresh conversation panel if it's open (messages may have updated)
  refreshMessages();
}

function onWall(wallMsg) {
  // Render text immediately when the event arrives; do not gate board updates
  // on goose movement callbacks, which can be dropped during rapid posting.
  updateBoardTexture(wallMsg);

  // If a human posted and the orchestrator is in the pen, revive it
  if (wallMsg.sender_id === 'human') {
    for (const [, goose] of geese) {
      if (goose.role === 'orchestrator' && goose.inPen) {
        goose.leavePen(new THREE.Vector3(0, 0.1, 0));
        break;
      }
    }
  }

  const goose = geese.get(wallMsg.sender_id);
  if (goose) {
    goose.goPost();
  }
}

function onWallRead(evt) {
  const goose = geese.get(evt.reader_id);
  if (goose) goose.goRead();
}

// ── SSE ─────────────────────────────────────────────────────────────────
let currentSSE = null;
let reconnectTimer = null;
let lastSSEEventAt = 0;

function markSSEEvent() {
  lastSSEEventAt = Date.now();
}

function scheduleSSEReconnect(delayMs = 3000) {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectSSE();
  }, delayMs);
}

function connectSSE() {
  if (currentSSE) {
    currentSSE.close();
    currentSSE = null;
  }

  const es = new EventSource('/events');
  currentSSE = es;
  markSSEEvent();

  es.addEventListener('bootstrap', (e) => {
    try {
      markSSEEvent();
      const data = JSON.parse(e.data);
      console.log('[Town] bootstrap:', {
        wallLines: data.wall?.lines?.length ?? 0,
        treeChildren: data.tree?.children?.length ?? 0,
      });
      if (data.tree) onTree(data.tree);
      if (data.wall?.lines) {
        for (const line of data.wall.lines.slice(-6)) {
          updateBoardTexture(line);
        }
      }
      if (data.files) {
        for (const f of data.files) {
          if (!notes.has(f.path)) {
            const mesh = createNoteMesh(f.filename);
            addNoteToDesk(mesh, f.path, f.filename);
          }
        }
      }
    } catch (err) { console.error('[Town] bootstrap error:', err); }
  });

  es.addEventListener('tree', (e) => {
    try {
      markSSEEvent();
      onTree(JSON.parse(e.data));
    } catch (err) { console.error('[Town] tree error:', err); }
  });

  es.addEventListener('wall', (e) => {
    try {
      markSSEEvent();
      onWall(JSON.parse(e.data));
    } catch (err) { console.error('[Town] wall error:', err); }
  });

  es.addEventListener('wall_read', (e) => {
    try {
      markSSEEvent();
      onWallRead(JSON.parse(e.data));
    } catch (_) {}
  });

  es.addEventListener('file_created', (e) => {
    try {
      markSSEEvent();
      onFileCreated(JSON.parse(e.data));
    } catch (err) { console.error('[Town] file_created error:', err); }
  });

  es.addEventListener('file_deleted', (e) => {
    try {
      markSSEEvent();
      const data = JSON.parse(e.data);
      removeNote(data.path);
    } catch (err) { console.error('[Town] file_deleted error:', err); }
  });

  es.addEventListener('wall_reset', (e) => {
    try {
      markSSEEvent();
      // Clean slate — remove all geese from scene and clear state
      geese.forEach(goose => goose.dispose());
      geese.clear();
      recentWallMessages.length = 0;
      seenWallKeys.clear();
      redrawBoard();
      clearAllNotes();
      console.log('[Town] wall_reset — scene cleared for new launch');
    } catch (_) {}
  });

  es.onerror = () => {
    if (currentSSE !== es) return;
    es.close();
    currentSSE = null;
    scheduleSSEReconnect();
  };
}

connectSSE();

setInterval(() => {
  if (!currentSSE) return;
  if (Date.now() - lastSSEEventAt > 20000) {
    currentSSE.close();
    currentSSE = null;
    scheduleSSEReconnect(0);
  }
}, 5000);

// ── Raycasting ──────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener('click', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  // Check goose meshes
  for (const [, goose] of geese) {
    const hits = raycaster.intersectObject(goose.mesh, true);
    if (hits.length > 0) {
      openPanel(goose);
      return;
    }
  }

  // Check desk area (desk top + any notes on it)
  const deskTargets = [deskTop, ...[...notes.values()].map(n => n.mesh)];
  const deskHits = raycaster.intersectObjects(deskTargets);
  if (deskHits.length > 0) {
    closePanel();
    hideWallForm();
    openDeskBrowser([...notes.values()].map(n => ({ path: n.path, filename: n.filename })));
    return;
  }

  // Check bulletin board (frame or face)
  const boardHits = raycaster.intersectObjects([frame, face, boardTextMesh]);
  if (boardHits.length > 0) {
    closePanel();
    closeFilePanel();
    closeDeskBrowser();
    showWallForm();
    return;
  }

  // Click on empty space — close everything
  closePanel();
  closeFilePanel();
  closeDeskBrowser();
  hideWallForm();
});

// ── Resize ──────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Launch Control ──────────────────────────────────────────────────────
const launchOpenBtn = document.getElementById('launch-open-btn');
const launchModal = document.getElementById('launch-modal');
const launchPrompt = document.getElementById('launch-prompt');
const launchInstructions = document.getElementById('launch-instructions');
const launchGoBtn = document.getElementById('launch-go-btn');
const launchCancelBtn = document.getElementById('launch-cancel-btn');
const launchStatusText = document.getElementById('launch-status-text');
const launchStopBtn = document.getElementById('launch-stop-btn');

launchOpenBtn.addEventListener('click', () => {
  launchModal.classList.remove('hidden');
  launchPrompt.focus();
});

launchCancelBtn.addEventListener('click', () => {
  launchModal.classList.add('hidden');
});

launchModal.addEventListener('click', (e) => {
  if (e.target === launchModal) launchModal.classList.add('hidden');
});

const launchRole = document.getElementById('launch-role');

launchGoBtn.addEventListener('click', async () => {
  const prompt = launchPrompt.value.trim();
  const instrFile = launchInstructions.value.trim();
  if (!prompt && !instrFile) return;

  launchGoBtn.disabled = true;
  launchGoBtn.textContent = 'Launching...';

  try {
    const body = { role: launchRole.value.trim() || 'orchestrator' };
    if (instrFile) body.instructions_file = instrFile;
    else body.prompt = prompt;

    const res = await fetch('/api/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Launch failed');
      return;
    }
    launchModal.classList.add('hidden');
    launchPrompt.value = '';
    launchInstructions.value = '';
  } catch (err) {
    alert('Launch failed: ' + err.message);
  } finally {
    launchGoBtn.disabled = false;
    launchGoBtn.textContent = 'Launch';
  }
});

launchStopBtn.addEventListener('click', async () => {
  if (!confirm('Stop the running orchestration?')) return;
  try {
    await fetch('/api/launch/stop', { method: 'POST' });
  } catch (_) {}
});

// Poll launch status
async function pollLaunchStatus() {
  try {
    const res = await fetch('/api/launch/status');
    const data = await res.json();
    launchRunning = data.status === 'running';
    launchStatusText.textContent =
      data.status === 'running' ? `Running (${data.elapsed_seconds}s)` :
      data.status === 'exited' ? `Exited (code ${data.exit_code})` :
      'Idle';
    launchStatusText.className = data.status;
    launchStopBtn.classList.toggle('hidden', data.status !== 'running');
    launchOpenBtn.style.display = data.status === 'running' ? 'none' : '';
  } catch (_) {}
}

setInterval(pollLaunchStatus, 2000);
pollLaunchStatus();

// ── Animate ─────────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  geese.forEach(g => g.update(dt));
  controls.update();
  renderer.render(scene, camera);
}

animate();
