import type { FortuneKind, Resource, ResourceCounts, Terrain } from './types.ts';
import { RESOURCES } from './types.ts';

export const TERRAIN_RESOURCE: Record<Terrain, Resource | null> = {
  grove: 'timber',
  claypit: 'clay',
  meadow: 'fleece',
  fields: 'grain',
  crags: 'stone',
  dunes: null,
};

export const TERRAIN_POOL: Terrain[] = [
  ...Array<Terrain>(4).fill('grove'),
  ...Array<Terrain>(3).fill('claypit'),
  ...Array<Terrain>(4).fill('meadow'),
  ...Array<Terrain>(4).fill('fields'),
  ...Array<Terrain>(3).fill('crags'),
  'dunes',
];

export const TOKEN_POOL: number[] = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

export const HARBOR_POOL = ['any', 'any', 'any', 'any', 'timber', 'clay', 'fleece', 'grain', 'stone'] as const;

/** Gaps (in coastal edges) between successive harbors around a 30-edge coast. */
export const HARBOR_GAPS = [3, 3, 4, 3, 3, 4, 3, 3, 4];

export const FORTUNE_POOL: FortuneKind[] = [
  ...Array<FortuneKind>(14).fill('warden'),
  ...Array<FortuneKind>(5).fill('relic'),
  ...Array<FortuneKind>(2).fill('trailblazer'),
  ...Array<FortuneKind>(2).fill('windfall'),
  ...Array<FortuneKind>(2).fill('embargo'),
];

export const BANK_PER_RESOURCE = 19;

export const PIECES = { trails: 15, outposts: 5, towns: 4 } as const;

export const COSTS = {
  trail: counts({ timber: 1, clay: 1 }),
  outpost: counts({ timber: 1, clay: 1, fleece: 1, grain: 1 }),
  town: counts({ grain: 2, stone: 3 }),
  fortune: counts({ fleece: 1, grain: 1, stone: 1 }),
} as const;

export const LONGEST_TRAIL_MIN = 5;
export const GRAND_WATCH_MIN = 3;
export const AWARD_VP = 2;

/** Probability "pips" for each token, used by bots and the UI's token dots. */
export const PIPS: Record<number, number> = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

export const RESOURCE_LABEL: Record<Resource, string> = {
  timber: 'Timber',
  clay: 'Clay',
  fleece: 'Fleece',
  grain: 'Grain',
  stone: 'Stone',
};

export const FORTUNE_LABEL: Record<FortuneKind, string> = {
  warden: 'Warden',
  trailblazer: 'Trailblazer',
  windfall: 'Windfall',
  embargo: 'Embargo',
  relic: 'Relic',
};

export const FORTUNE_TEXT: Record<FortuneKind, string> = {
  warden: 'Move the Raider and steal a card. Three or more Wardens can earn the Grand Watch.',
  trailblazer: 'Build two trails for free.',
  windfall: 'Take any two resources from the bank.',
  embargo: 'Name a resource. Every other player hands you all of theirs.',
  relic: 'Worth 1 victory point. Kept secret until the game ends.',
};

export const TERRAIN_LABEL: Record<Terrain, string> = {
  grove: 'Grove',
  claypit: 'Claypit',
  meadow: 'Meadow',
  fields: 'Fields',
  crags: 'Crags',
  dunes: 'Dunes',
};

// ---------------------------------------------------------------------------
// ResourceCounts helpers

export function emptyCounts(): ResourceCounts {
  return { timber: 0, clay: 0, fleece: 0, grain: 0, stone: 0 };
}

export function counts(partial: Partial<ResourceCounts>): ResourceCounts {
  return { ...emptyCounts(), ...partial };
}

export function totalCards(c: Partial<ResourceCounts>): number {
  let n = 0;
  for (const r of RESOURCES) n += c[r] ?? 0;
  return n;
}

export function hasCards(have: ResourceCounts, need: Partial<ResourceCounts>): boolean {
  return RESOURCES.every((r) => have[r] >= (need[r] ?? 0));
}

export function addCards(into: ResourceCounts, add: Partial<ResourceCounts>, sign = 1): void {
  for (const r of RESOURCES) into[r] += sign * (add[r] ?? 0);
}

/** Validates a client-supplied counts object: known keys only, non-negative integers. */
export function isValidCounts(c: unknown): c is ResourceCounts {
  if (!c || typeof c !== 'object') return false;
  const obj = c as Record<string, unknown>;
  for (const key of Object.keys(obj)) if (!(RESOURCES as readonly string[]).includes(key)) return false;
  return RESOURCES.every((r) => {
    const v = obj[r] ?? 0;
    return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 99;
  });
}

export function normalizeCounts(c: Partial<ResourceCounts>): ResourceCounts {
  return counts(c);
}

export function isResource(r: unknown): r is Resource {
  return typeof r === 'string' && (RESOURCES as readonly string[]).includes(r);
}
