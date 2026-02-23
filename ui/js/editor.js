import {
  html,
  svg,
  render,
} from 'https://cdn.jsdelivr.net/npm/lit-html@3.3.2/+esm';
import { MAP_CONFIG } from './map.js';
import { SvgDefs } from './assets.js';
import { BUILDINGS, BUILDING_CHARS } from './buildings.js';
import { TILE_SIZE, tileForChar, decoForChar } from './tiles.js';

const GRID_W = 60;
const GRID_H = 25;

const TILES = [
  { char: '.', label: 'Grass (Eraser)', type: 'base' },
  { char: '#', label: 'Dirt Path', type: 'base' },
  { char: ':', label: 'Cobblestone', type: 'base' },
  { char: '+', label: 'Plaza Tile', type: 'base' },
  { char: '~', label: 'River', type: 'base' },
  { char: 'P', label: 'Pond', type: 'base' },
  { char: '=', label: 'Bridge', type: 'base' },
  { char: 'A', label: 'Farm', type: 'base' },
  { char: 'K', label: 'Fountain', type: 'base' },
  { char: '%', label: 'Stone Wall', type: 'base' },
  { char: 'T', label: 'Pine Tree', type: 'dec' },
  { char: 'O', label: 'Oak Tree', type: 'dec' },
  { char: '*', label: 'Flowers', type: 'dec' },
  { char: 'R', label: 'Rock', type: 'dec' },
  { char: 'l', label: 'Street Lamp', type: 'dec' },
  { char: 'p', label: 'Pipes', type: 'dec' },
  { char: 'G', label: 'Giant Gear', type: 'dec' },
  // Building tiles derived from the single source of truth
  ...Object.entries(BUILDINGS).map(([char, b]) => ({
    char,
    label: b.label,
    type: 'bldg',
  })),
];

let mapGrid = Array(GRID_H)
  .fill(null)
  .map(() => Array(GRID_W).fill('.'));
let currentBrush = '#';
let isDrawing = false;

const mapSections = MAP_CONFIG.split('[Map]');
const INITIAL_MAP = mapSections[1].trim();

function loadMapString(str) {
  // Reset grid before loading — prevents stale tiles when loading shorter maps
  mapGrid = Array(GRID_H)
    .fill(null)
    .map(() => Array(GRID_W).fill('.'));
  const lines = str
    .trim()
    .split('\n')
    .filter((l) => l.length > 0);
  for (let y = 0; y < Math.min(GRID_H, lines.length); y++) {
    for (let x = 0; x < Math.min(GRID_W, lines[y].length); x++) {
      mapGrid[y][x] = lines[y][x];
    }
  }
  updateUI();
}

function exportMapString() {
  return mapGrid.map((row) => row.join('')).join('\n');
}

function renderTileIcon(char) {
  if (char === '.')
    return svg`<rect width="40" height="40" fill="url(#grass-pat)"/>`;
  if (char === '#') return svg`<use href="#tile-path"/>`;
  if (char === ':') return svg`<use href="#tile-cobble"/>`;
  if (char === '+') return svg`<use href="#tile-plaza"/>`;
  if (char === '%') return svg`<use href="#tile-stone-wall"/>`;
  if (char === '~') return svg`<use href="#tile-water"/>`;
  if (char === 'P') return svg`<use href="#tile-pond"/>`;
  if (char === '=') return svg`<use href="#tile-bridge"/>`;
  if (char === 'A') return svg`<use href="#tile-farm"/>`;
  if (char === 'K')
    return svg`<use href="#tile-fountain-grand" transform="scale(0.5) translate(-4, -4)"/>`;
  if (char === 'T') return svg`<use href="#tree-pine" y="-10"/>`;
  if (char === 'O') return svg`<use href="#tree-oak" y="-10"/>`;
  if (char === '*') return svg`<use href="#bush"/>`;
  if (char === 'R') return svg`<use href="#rock"/>`;
  if (char === 'l') return svg`<use href="#deco-lamp"/>`;
  if (char === 'p') return svg`<use href="#deco-pipes"/>`;
  if (char === 'G') return svg`<use href="#deco-gear"/>`;
  // Buildings from the registry — auto-scales with new entries
  if (BUILDINGS[char])
    return svg`<g transform="scale(0.2) translate(20, 20)">${BUILDINGS[char].svg}</g>`;
  return svg`<rect width="36" height="36" x="2" y="2" fill="#2D2118" stroke="#B87333" stroke-width="2"/><text x="20" y="26" fill="#fff" font-size="20" text-anchor="middle" font-weight="bold">${char}</text>`;
}

function handlePointerDown(e) {
  isDrawing = true;
  paintTile(e);
}

function handlePointerUp() {
  if (isDrawing) {
    isDrawing = false;
    updateUI();
  }
}

function handlePointerMove(e) {
  if (isDrawing) paintTile(e);
}

function paintTile(e) {
  const svgEl = e.currentTarget;
  const refEl = document.getElementById('viewbox-reference') || svgEl;

  const pt = svgEl.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;

  const ctm = refEl.getScreenCTM();
  if (!ctm) return;
  const svgP = pt.matrixTransform(ctm.inverse());

  const x = Math.floor(svgP.x / TILE_SIZE);
  const y = Math.floor(svgP.y / TILE_SIZE);

  if (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) {
    if (mapGrid[y][x] !== currentBrush) {
      mapGrid[y][x] = currentBrush;
      renderCanvasOnly();
    }
  }
}

function renderCanvasContent() {
  const elements = [];

  elements.push(
    svg`<g id="viewbox-reference"><rect x="0" y="0" width="${GRID_W * TILE_SIZE}" height="${GRID_H * TILE_SIZE}" fill="transparent"/></g>`
  );

  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const char = mapGrid[y][x];
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      elements.push(
        svg`<rect x="${px}" y="${py}" width="${TILE_SIZE}" height="${TILE_SIZE}" fill="url(#grass-pat)"/>`
      );

      // --- Terrain tiles (shared via tiles.js) ---
      const tile = tileForChar(char, px, py);
      if (tile) {
        elements.push(tile);
      } else if (char === 'K') {
        // Editor-specific: simplified fountain placeholder
        const isTopLeft =
          (x === 0 || mapGrid[y][x - 1] !== 'K') &&
          (y === 0 || mapGrid[y - 1][x] !== 'K');
        if (isTopLeft)
          elements.push(
            svg`<rect width="44" height="44" x="${px - 2}" y="${py - 2}" fill="#E0E0E0" rx="4"/>`
          );
      }
    }
  }

  // --- Grid lines (editor-only) ---
  for (let x = 0; x <= GRID_W; x++) {
    elements.push(
      svg`<line x1="${x * TILE_SIZE}" y1="0" x2="${x * TILE_SIZE}" y2="${GRID_H * TILE_SIZE}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`
    );
  }
  for (let y = 0; y <= GRID_H; y++) {
    elements.push(
      svg`<line x1="0" y1="${y * TILE_SIZE}" x2="${GRID_W * TILE_SIZE}" y2="${y * TILE_SIZE}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`
    );
  }

  const decos = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const char = mapGrid[y][x];
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      // --- Decorations (shared via tiles.js) ---
      const deco = decoForChar(char, px, py);
      if (deco) {
        decos.push({
          y: py,
          el: svg`<g style="pointer-events: none;">${deco}</g>`,
        });
      }

      // --- Fountain (editor-specific simplified rendering) ---
      if (char === 'K') {
        const isTopLeft =
          (x === 0 || mapGrid[y][x - 1] !== 'K') &&
          (y === 0 || mapGrid[y - 1][x] !== 'K');
        if (isTopLeft) {
          decos.push({
            y: py + TILE_SIZE,
            el: svg`<use style="pointer-events: none;" href="#tile-fountain-grand" x="${px}" y="${py}"/>`,
          });
        }
      }

      // --- Buildings — driven by BUILDINGS table, no hardcoded char matching ---
      if (BUILDINGS[char]) {
        decos.push({
          y: py,
          el: svg`
          <g transform="translate(${px}, ${py})" style="pointer-events: none;">
            <rect x="0" y="0" width="${TILE_SIZE}" height="${TILE_SIZE}" fill="rgba(184, 115, 51, 0.4)" stroke="#B87333" stroke-width="2" stroke-dasharray="4 2"/>
            <g transform="translate(-80, -160)">${BUILDINGS[char].svg}</g>
            <foreignObject x="-70" y="-30" width="140" height="40" style="overflow: visible; pointer-events: none;">
              <div style="pointer-events: none; display: inline-block; background: rgba(0,0,0,0.8); color: #FFF; padding: 4px 8px; border: 1px solid #B87333; border-radius: 4px; font-size: 11px; white-space: nowrap; text-align: center;">
                ${BUILDINGS[char].label}
              </div>
            </foreignObject>
          </g>
        `,
        });
      }
    }
  }
  decos.sort((a, b) => a.y - b.y);

  return html`
    ${SvgDefs}
    ${elements}
    ${decos.map((d) => d.el)}
  `;
}

function renderCanvasOnly() {
  const container = document.getElementById('map-canvas');
  if (container) {
    render(renderCanvasContent(), container);
  }
}

function updateUI() {
  render(App(), document.getElementById('app'));
}

const App = () => html`
  <header>
    <h1>Goosetown Map Editor</h1>
    <a href="/ui/index.html" style="color: var(--accent); text-decoration: none;">&larr; Back to Dashboard</a>
  </header>

  <div class="layout">
    <aside class="palette">
      ${TILES.map(
        (t) => html`
        <button class="palette-btn ${currentBrush === t.char ? 'active' : ''}" @click=${() => {
          currentBrush = t.char;
          updateUI();
        }}>
          <div class="palette-icon">
            <svg viewBox="0 0 40 40" width="100%" height="100%">
              ${SvgDefs}
              <rect width="40" height="40" fill="url(#grass-pat)"/>
              ${renderTileIcon(t.char)}
            </svg>
          </div>
          ${t.label}
        </button>
      `
      )}
    </aside>

    <div class="canvas-container">
      <svg id="map-canvas" viewBox="0 0 ${GRID_W * TILE_SIZE} ${GRID_H * TILE_SIZE}" width="100%" height="100%"
           @pointerdown=${handlePointerDown}
           @pointerup=${handlePointerUp}
           @pointerleave=${handlePointerUp}
           @pointermove=${handlePointerMove}>
        ${renderCanvasContent()}
      </svg>
    </div>
  </div>

  <div class="io-panel">
    <div class="io-controls">
      <span style="color: var(--accent); font-weight: bold;">ASCII Export</span>
      <button @click=${() => {
        const ta = document.getElementById('io-text');
        loadMapString(ta.value);
      }}>Load from Text</button>
    </div>
    <textarea id="io-text" spellcheck="false">${exportMapString()}</textarea>
  </div>
`;

loadMapString(INITIAL_MAP);
updateUI();
