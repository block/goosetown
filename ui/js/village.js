import { html, svg } from 'https://cdn.jsdelivr.net/npm/lit-html@3.3.2/+esm';
import { MAP_CONFIG } from './map.js';
import { SvgDefs } from './assets.js';
import {
  BUILDINGS,
  BUILDING_CHARS,
  ROLE_TO_BUILDING,
  inferRole,
} from './buildings.js';
import { TILE_SIZE, tileForChar, decoForChar } from './tiles.js';

const SPEECH_DURATION_MS = 8000;
const SPEECH_MAX_LENGTH = 120;
const GOOSE_SPEED_PX_PER_SEC = 160;
const DT_CLAMP_SEC = 0.05;
const HALF_TILE = TILE_SIZE / 2; // Center goose sprite on tile rather than tile top-left

let TOWN_MAP_GRID = [];
let BUILDING_POSITIONS = {};
let MAP_WIDTH = 0;
let MAP_HEIGHT = 0;

function initMap() {
  try {
    BUILDING_POSITIONS = {};

    const sections = MAP_CONFIG.split('[Map]');
    const rawMap = (sections[1] || '')
      .trim()
      .split('\n')
      .filter((l) => l.length > 0);
    TOWN_MAP_GRID = rawMap.map((line) => line.split(''));

    MAP_WIDTH = (TOWN_MAP_GRID[0]?.length || 0) * TILE_SIZE;
    MAP_HEIGHT = TOWN_MAP_GRID.length * TILE_SIZE;

    for (let y = 0; y < TOWN_MAP_GRID.length; y++) {
      for (let x = 0; x < TOWN_MAP_GRID[y].length; x++) {
        const c = TOWN_MAP_GRID[y][x];
        if (BUILDINGS[c])
          BUILDING_POSITIONS[BUILDINGS[c].key] = {
            gridX: x,
            gridY: y,
            ...BUILDINGS[c],
          };
      }
    }
  } catch (e) {
    console.error('[village] Failed to parse map:', e);
  }
}
initMap();

function findPath(startX, startY, endX, endY, grid) {
  if (!grid?.length || !grid[0]?.length) return [];
  const w = grid[0].length;
  const h = grid.length;

  const getCost = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return Infinity;
    const char = grid[y][x];
    if (
      char === ':' ||
      char === '+' ||
      char === '=' ||
      BUILDING_CHARS.includes(char)
    )
      return 1;
    if (char === '#') return 2;
    if (char === '.' || char === 'A' || char === 'K') return 5;
    return Infinity;
  };

  const heuristic = (x, y) => Math.abs(x - endX) + Math.abs(y - endY);

  const openSet = [
    { x: startX, y: startY, g: 0, f: heuristic(startX, startY), parent: null },
  ];
  const closedSet = new Set();
  const hash = (x, y) => `${x},${y}`;

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f);
    const curr = openSet.shift();

    if (curr.x === endX && curr.y === endY) {
      const path = [];
      let currNode = curr;
      while (currNode) {
        if (currNode.parent) path.unshift({ x: currNode.x, y: currNode.y });
        currNode = currNode.parent;
      }
      return path;
    }

    closedSet.add(hash(curr.x, curr.y));

    const neighbors = [
      { x: curr.x + 1, y: curr.y },
      { x: curr.x - 1, y: curr.y },
      { x: curr.x, y: curr.y + 1 },
      { x: curr.x, y: curr.y - 1 },
    ];

    for (const n of neighbors) {
      if (closedSet.has(hash(n.x, n.y))) continue;
      const cost = getCost(n.x, n.y);
      if (cost === Infinity) continue;

      const g = curr.g + cost;
      const existing = openSet.find((o) => o.x === n.x && o.y === n.y);

      if (!existing) {
        openSet.push({
          x: n.x,
          y: n.y,
          g,
          f: g + heuristic(n.x, n.y),
          parent: curr,
        });
      } else if (g < existing.g) {
        existing.g = g;
        existing.f = g + heuristic(n.x, n.y);
        existing.parent = curr;
      }
    }
  }
  return [];
}

let cachedMapData = null;

function parseMap() {
  if (cachedMapData) return cachedMapData;
  const tiles = [];
  const decorations = [];
  let hasSwimmingGoose = false;
  let hasFarmerGoose = false;

  for (let y = 0; y < TOWN_MAP_GRID.length; y++) {
    for (let x = 0; x < TOWN_MAP_GRID[y].length; x++) {
      const char = TOWN_MAP_GRID[y][x];
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      // --- Terrain tiles (shared via tiles.js) ---
      const tile = tileForChar(char, px, py);
      if (tile) {
        tiles.push(tile);
      }

      // --- Special terrain with village-specific side-effects ---
      if (char === 'P' && (!hasSwimmingGoose || Math.random() < 0.05)) {
        hasSwimmingGoose = true;
        const delay = -(Math.random() * 5).toFixed(2);
        decorations.push({
          y: py,
          element: svg`
            <g transform="translate(${px}, ${py})">
              <g class="anim-wander" style="animation-delay: ${delay}s">
                <use href="#goose-swimming"/>
              </g>
            </g>
          `,
        });
      } else if (char === 'K') {
        const isTopLeft =
          (x === 0 || TOWN_MAP_GRID[y][x - 1] !== 'K') &&
          (y === 0 || TOWN_MAP_GRID[y - 1][x] !== 'K');
        if (isTopLeft) {
          decorations.push({
            y: py + TILE_SIZE,
            element: svg`<use href="#tile-fountain-grand" x="${px}" y="${py}"/>`,
          });
        }
      } else if (char === 'A' && !hasFarmerGoose) {
        hasFarmerGoose = true;
        decorations.push({
          y: py + 20,
          element: svg`
            <g transform="translate(${px}, ${py - 10})">
              <g class="anim-farm-wander">
                <foreignObject x="-32" y="-64" width="64" height="64" style="overflow: visible;">
                  <div class="v-goose-anim walking" style="width: 64px; height: 64px;">
                    <svg viewBox="0 0 64 64" width="100%" height="100%"><use href="#goose"/></svg>
                  </div>
                </foreignObject>
              </g>
            </g>
          `,
        });
      }

      // --- Decorations (shared via tiles.js) ---
      const deco = decoForChar(char, px, py);
      if (deco) {
        // decoForChar returns the SVG element; wrap with y-sort key
        const decoY = char === 'T' ? py - 20 : char === 'O' ? py - 15 : py;
        decorations.push({ y: decoY, element: deco });
      }
    }
  }

  const ambientForest = [];
  for (let y = -400; y < MAP_HEIGHT + 400; y += 40) {
    for (let x = -800; x < MAP_WIDTH + 800; x += 40) {
      if (x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT) continue;

      let isRiver = false;
      const gridX = Math.floor(x / TILE_SIZE);
      const gridY = Math.floor(y / TILE_SIZE);

      if (x >= 0 && x < MAP_WIDTH) {
        if (y < 0 && TOWN_MAP_GRID[0] && TOWN_MAP_GRID[0][gridX] === '~')
          isRiver = true;
        if (
          y >= MAP_HEIGHT &&
          TOWN_MAP_GRID[TOWN_MAP_GRID.length - 1] &&
          TOWN_MAP_GRID[TOWN_MAP_GRID.length - 1][gridX] === '~'
        )
          isRiver = true;
      }
      if (y >= 0 && y < MAP_HEIGHT) {
        if (x < 0 && TOWN_MAP_GRID[gridY] && TOWN_MAP_GRID[gridY][0] === '~')
          isRiver = true;
        if (
          x >= MAP_WIDTH &&
          TOWN_MAP_GRID[gridY] &&
          TOWN_MAP_GRID[gridY][TOWN_MAP_GRID[gridY].length - 1] === '~'
        )
          isRiver = true;
      }

      if (isRiver) {
        tiles.push(svg`<use href="#tile-water" x="${x}" y="${y}"/>`);
        continue;
      }

      if (Math.random() < 0.4) {
        const type = Math.random() > 0.4 ? '#tree-pine' : '#tree-oak';
        const jx = x + (Math.random() * 20 - 10);
        const jy = y + (Math.random() * 20 - 10);
        ambientForest.push({
          y: jy,
          element: svg`<use href="${type}" x="${jx}" y="${jy}"/>`,
        });
      }
    }
  }

  const allDecorations = [...ambientForest, ...decorations];
  allDecorations.sort((a, b) => a.y - b.y);

  cachedMapData = {
    tiles,
    decorations: allDecorations.map((d) => d.element),
  };
  return cachedMapData;
}

function getTargetBuilding(role, status) {
  if (status === 'complete' || status === 'error' || status === 'idle')
    return 'barn';
  return ROLE_TO_BUILDING[role] || 'forge';
}

const geeseState = new Map();

let loopRunning = false;
let villageVisible = true; // toggled by app.js when village panel shown/hidden
export function setVillageVisible(v) {
  villageVisible = v;
  if (v) startLoop();
}

export function startLoop() {
  if (loopRunning) return;
  loopRunning = true;
  let lastTime = performance.now();

  function tick(now) {
    // Stop when tab hidden or village panel not visible
    if (document.visibilityState === 'hidden' || !villageVisible) {
      loopRunning = false;
      return;
    }

    const dt = Math.min((now - lastTime) / 1000, DT_CLAMP_SEC); // clamp — prevents teleport after tab restore
    lastTime = now;

    const speed = GOOSE_SPEED_PX_PER_SEC * dt;
    let needsRender = false;
    let hasActivePath = false;

    for (const [id, goose] of geeseState.entries()) {
      if (goose.path && goose.path.length > 0) {
        hasActivePath = true;
        goose.action = 'walking';
        const targetNode = goose.path[0];
        const targetPx = targetNode.x * TILE_SIZE;
        const targetPy = targetNode.y * TILE_SIZE;

        const dx = targetPx - goose.x;
        const dy = targetPy - goose.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < speed) {
          goose.x = targetPx;
          goose.y = targetPy;
          goose.path.shift();

          if (goose.path.length === 0) {
            goose.action = goose.status === 'active' ? 'working' : 'idle';
            const barn = BUILDING_POSITIONS.barn;
            if (
              barn &&
              (goose.status === 'complete' || goose.status === 'idle') &&
              goose.targetGridX === barn.gridX &&
              goose.targetGridY === barn.gridY
            )
              goose.hidden = true;
            needsRender = true;
          }
        } else {
          goose.x += (dx / dist) * speed;
          goose.y += (dy / dist) * speed;
        }

        // Cache DOM refs — cleared on re-render via isConnected check
        if (!goose._el || !goose._el.isConnected) {
          goose._el = document.getElementById(`goose-wrapper-${id}`);
          goose._flipEl = goose._el?.querySelector('.v-goose-flip') || null;
        }
        const el = goose._el;
        if (el) {
          // Direct DOM transform is cheaper than re-rendering SVG every frame.
          // HALF_TILE centers the sprite on the tile (data uses tile top-left).
          el.style.transform = `translate(${goose.x + goose.offsetX + HALF_TILE}px, ${goose.y + goose.offsetY + HALF_TILE}px)`;
          const flipEl = goose._flipEl;
          if (flipEl) {
            if (dx > 0.5) flipEl.style.transform = 'scaleX(1)';
            else if (dx < -0.5) flipEl.style.transform = 'scaleX(-1)';
          }
        }
      } else {
        if (!goose._el || !goose._el.isConnected) {
          goose._el = document.getElementById(`goose-wrapper-${id}`);
        }
        const el = goose._el;
        if (el)
          el.style.transform = `translate(${goose.x + goose.offsetX + HALF_TILE}px, ${goose.y + goose.offsetY + HALF_TILE}px)`;
      }
    }

    if (needsRender) {
      document.dispatchEvent(new CustomEvent('goosetown-render'));
    }

    if (!hasActivePath) {
      loopRunning = false;
      return;
    }
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if ([...geeseState.values()].some((g) => g.path?.length)) startLoop();
});

export function updateVillageState(globalState) {
  const {
    tree = { children: [], sender_map: {} },
    sessions = [],
    wallMessages = [],
  } = globalState;
  const now = Date.now();

  const allDelegates = [...(tree.children || [])];
  if (tree.parent_session_id) {
    const orch = sessions.find((s) => s.id === tree.parent_session_id);
    if (orch && !orch.name?.toLowerCase().includes('dashboard')) {
      allDelegates.push({ ...orch, role: 'orchestrator' });
    }
  }

  const liveIds = new Set(allDelegates.map((d) => d.id));

  for (const delegate of allDelegates) {
    const role = delegate.role || inferRole(delegate.name || delegate.id);
    const targetBuildingKey = getTargetBuilding(role, delegate.status);
    const barn = BUILDING_POSITIONS.barn;
    const targetBuilding = BUILDING_POSITIONS[targetBuildingKey] || barn;
    if (!targetBuilding) continue;

    if (!geeseState.has(delegate.id)) {
      const isNew = (delegate.elapsed_seconds || 0) < 10;
      const spawnBuilding =
        isNew || delegate.status === 'complete' || delegate.status === 'idle'
          ? barn || targetBuilding
          : targetBuilding;

      geeseState.set(delegate.id, {
        id: delegate.id,
        gtwall_id: delegate.gtwall_id || delegate.name || delegate.id,
        role,
        x: spawnBuilding.gridX * TILE_SIZE,
        y: spawnBuilding.gridY * TILE_SIZE,
        offsetX: Math.random() * 50 - 25,
        offsetY: Math.random() * 20 - 10,
        targetGridX: spawnBuilding.gridX,
        targetGridY: spawnBuilding.gridY,
        status: delegate.status,
        action: 'idle',
        hidden: false,
        speech: null,
        path: [],
      });
    }

    const goose = geeseState.get(delegate.id);
    goose.status = delegate.status;

    const wantsNewTarget =
      goose.targetGridX !== targetBuilding.gridX ||
      goose.targetGridY !== targetBuilding.gridY;
    if (wantsNewTarget) {
      const currentGridX = Math.floor(goose.x / TILE_SIZE);
      const currentGridY = Math.floor(goose.y / TILE_SIZE);

      const path = findPath(
        currentGridX,
        currentGridY,
        targetBuilding.gridX,
        targetBuilding.gridY,
        TOWN_MAP_GRID
      );
      if (path.length > 0) {
        goose.targetGridX = targetBuilding.gridX;
        goose.targetGridY = targetBuilding.gridY;
        goose.path = path;
        goose.hidden = false;
        goose.action = 'walking';
        startLoop();
      }
    } else if (!goose.path || goose.path.length === 0) {
      goose.action = delegate.status === 'active' ? 'working' : 'idle';
      if (
        barn &&
        (goose.status === 'complete' || goose.status === 'idle') &&
        goose.targetGridX === barn.gridX &&
        goose.targetGridY === barn.gridY
      ) {
        goose.hidden = true;
      } else {
        goose.hidden = false;
      }
    }
  }

  for (const id of geeseState.keys()) {
    if (!liveIds.has(id)) geeseState.delete(id);
  }

  // _receivedAt is stamped at ingestion (app.js). Only show recent messages as speech.
  const latestBySender = new Map();
  for (const m of wallMessages) {
    if (m._receivedAt && now - m._receivedAt < SPEECH_DURATION_MS) {
      latestBySender.set(m.sender_id, m);
    }
  }

  for (const goose of geeseState.values()) {
    let senderId = null;
    if (goose.role === 'orchestrator') {
      senderId = 'orchestrator';
    } else {
      for (const [sId, sessionId] of Object.entries(tree.sender_map || {})) {
        if (sessionId === goose.id) senderId = sId;
      }
    }
    if (!senderId) senderId = goose.gtwall_id;

    const msg = latestBySender.get(senderId);
    if (msg) {
      let text = msg.message;
      if (text.length > SPEECH_MAX_LENGTH) text = text.substring(0, SPEECH_MAX_LENGTH) + '...';
      goose.speech = text;
    } else {
      goose.speech = null;
    }
  }

  return geeseState;
}

export function renderVillage(globalState) {
  const geeseMap = updateVillageState(globalState);
  const h = new Date().getHours();
  const isDay = h > 6 && h < 18;
  const geese = Array.from(geeseMap.values());
  const mapData = parseMap();

  return html`
    <div class="village-viewport ${isDay ? 'day' : ''}">
      <svg class="terrain-layer" role="img" aria-label="Goosetown village map showing AI agent activity" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}" preserveAspectRatio="xMidYMid meet" style="width: 100%; height: 100%;">
        <title>Goosetown Village</title>
        ${SvgDefs}
        <rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#grass-pat)"/>

        ${mapData.tiles}
        ${mapData.decorations}

        ${Object.values(BUILDING_POSITIONS).map(
          (b) => svg`
            <g transform="translate(${b.gridX * TILE_SIZE}, ${b.gridY * TILE_SIZE})">
              <g transform="translate(-80, -160)" class="v-building-art">${b.svg || BUILDINGS.H.svg}</g>
              <foreignObject x="-70" y="-30" width="140" height="40" style="overflow: visible;">
                <div class="v-building-label" style="text-align: center;">${b.label}</div>
              </foreignObject>
            </g>
          `
        )}

        ${geese.map(
          (g) => svg`
            <g id="goose-wrapper-${g.id}" class="v-goose-wrapper ${g.hidden ? 'v-goose-hidden' : ''}" style="transform: translate(${g.x + g.offsetX + HALF_TILE}px, ${g.y + g.offsetY + HALF_TILE}px);">
              ${
                g.speech
                  ? svg`
                    <foreignObject x="-100" y="-60" width="200" height="40" style="overflow: visible;">
                      <!-- g.speech is auto-escaped by lit-html's tagged template — safe against XSS. -->
                      <!-- Do NOT use unsafeHTML here; wall messages are untrusted user input. -->
                      <div class="v-speech"><span class="v-speech-inner">${g.speech}</span></div>
                    </foreignObject>
                  `
                  : ''
              }
              <foreignObject x="-32" y="-64" width="64" height="64" style="overflow: visible;">
                <div class="v-goose-anim ${g.action}" style="width: 64px; height: 64px;">
                  <div class="v-goose-flip" style="width: 100%; height: 100%; transition: transform 0.2s;">
                    <svg viewBox="0 0 64 64" width="100%" height="100%">
                      <use href="#goose"/>
                      ${g.role === 'orchestrator' ? svg`<use href="#top-hat"/>` : ''}
                    </svg>
                  </div>
                </div>
              </foreignObject>
              <foreignObject x="-60" y="-5" width="120" height="30" style="overflow: visible;">
                <div class="v-nameplate" style="text-align: center;">${g.gtwall_id}</div>
              </foreignObject>
            </g>
          `
        )}
      </svg>
    </div>
  `;
}
