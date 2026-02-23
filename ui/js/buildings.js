import {
  BuildingApothecary,
  BuildingBarn,
  BuildingFactory,
  BuildingForge,
  BuildingHall,
  BuildingLibrary,
  BuildingMarket,
  BuildingScriptorium,
  BuildingTower,
} from './assets.js';

export const BUILDINGS = Object.freeze({
  B: {
    key: 'barn',
    label: 'Cozy Barn',
    svg: BuildingBarn,
    roles: ['idle', 'complete', 'error'],
  },
  L: {
    key: 'library',
    label: 'Grand Archive',
    svg: BuildingLibrary,
    roles: ['researcher'],
  },
  I: {
    key: 'inspector',
    label: "Inspector's Tower",
    svg: BuildingTower,
    roles: ['reviewer'],
  },
  F: {
    key: 'forge',
    label: 'Steam Forge',
    svg: BuildingForge,
    roles: ['generic'],
  },
  C: {
    key: 'factory',
    label: 'Cog Factory',
    svg: BuildingFactory,
    roles: ['worker'],
  },
  H: {
    key: 'hall',
    label: 'Town Hall',
    svg: BuildingHall,
    roles: ['orchestrator'],
  },
  W: {
    key: 'scriptorium',
    label: 'The Scriptorium',
    svg: BuildingScriptorium,
    roles: ['writer'],
  },
  // Decorative buildings — no role assigned, geese won't path here.
  // Reserved decoration chars (uppercase, not available as building keys): T, O, R, G
  S: {
    key: 'apothecary',
    label: 'Apothecary',
    svg: BuildingApothecary,
    roles: [],
  },
  M: {
    key: 'market',
    label: 'Market',
    svg: BuildingMarket,
    roles: [],
  },
});

export const BUILDING_CHARS = Object.keys(BUILDINGS);

export const ROLE_TO_BUILDING = Object.fromEntries(
  Object.entries(BUILDINGS).flatMap(([, b]) => b.roles.map((r) => [r, b.key]))
);

/**
 * Infer a delegate's role from its name using regex patterns.
 *
 * IMPORTANT: This logic is duplicated in scripts/goosetown-ui (ROLE_PATTERNS dict).
 * If you change patterns here, update the Python version to match.
 *
 * @param {string} name - Delegate name
 * @returns {string} Role key (orchestrator, researcher, worker, reviewer, writer, generic)
 */
export function inferRole(name) {
  if (!name) return 'generic';
  const n = name.toLowerCase();
  if (/orchestrat/.test(n)) return 'orchestrator';
  if (/research/.test(n)) return 'researcher';
  if (/worker|build|implement/.test(n)) return 'worker';
  if (/review|crossfire/.test(n)) return 'reviewer';
  if (/writ|spec|document/.test(n)) return 'writer';
  return 'generic';
}
