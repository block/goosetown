/**
 * tiles.js — Shared tile-mapping logic for village.js and editor.js.
 *
 * Centralises the char→SVG tile and decoration mappings that were previously
 * duplicated across both files.  Building-specific overlays, goose animations,
 * and editor-only chrome (grid lines, labels) stay in their respective files.
 */

import { svg } from 'https://cdn.jsdelivr.net/npm/lit-html@3.3.2/+esm';
import { BUILDING_CHARS } from './buildings.js';

/** Canonical tile size in pixels (was GRID_SIZE in village.js, TILE_SIZE in editor.js). */
export const TILE_SIZE = 40;

/**
 * Return an svg `<use>` element for the given terrain character, or null if
 * the character has no terrain tile (e.g. decoration-only chars like 'T').
 *
 * Building chars are rendered as plaza tiles — building art overlays are
 * handled separately by each consumer.
 */
export function tileForChar(char, px, py) {
  switch (char) {
    case '~':
      return svg`<use href="#tile-water" x="${px}" y="${py}"/>`;
    case 'P':
      return svg`<use href="#tile-pond" x="${px}" y="${py}"/>`;
    case '#':
      return svg`<use href="#tile-path" x="${px}" y="${py}"/>`;
    case ':':
      return svg`<use href="#tile-cobble" x="${px}" y="${py}"/>`;
    case '+':
      return svg`<use href="#tile-plaza" x="${px}" y="${py}"/>`;
    case '%':
      return svg`<use href="#tile-stone-wall" x="${px}" y="${py}"/>`;
    case '=':
      return svg`<use href="#tile-bridge" x="${px}" y="${py}"/>`;
    case 'A':
      return svg`<use href="#tile-farm" x="${px}" y="${py}"/>`;
    default:
      if (BUILDING_CHARS.includes(char))
        return svg`<use href="#tile-plaza" x="${px}" y="${py}"/>`;
      return null;
  }
}

/**
 * Return an svg `<use>` element for the given decoration character, or null
 * if the character is not a standard decoration.
 *
 * Fountain (K) is intentionally excluded — village.js and editor.js each
 * handle it with different top-left detection and rendering logic.
 */
export function decoForChar(char, px, py) {
  switch (char) {
    case 'T': {
      // Deterministic jitter seeded by position to avoid re-render flicker
      const seed = (px * 7 + py * 13) & 0xFFFF;
      const jx = px + ((seed % 10) - 5);
      const jy = py + (((seed >> 4) % 10) - 5) - 20;
      return svg`<use href="#tree-pine" x="${jx}" y="${jy}"/>`;
    }
    case 'O':
      return svg`<use href="#tree-oak" x="${px}" y="${py - 15}"/>`;
    case '*':
      return svg`<use href="#bush" x="${px}" y="${py}"/>`;
    case 'R':
      return svg`<use href="#rock" x="${px}" y="${py}"/>`;
    case 'l':
      return svg`<use href="#deco-lamp" x="${px}" y="${py}"/>`;
    case 'p':
      return svg`<use href="#deco-pipes" x="${px}" y="${py}"/>`;
    case 'G':
      return svg`<use href="#deco-gear" x="${px}" y="${py}"/>`;
    default:
      return null;
  }
}
