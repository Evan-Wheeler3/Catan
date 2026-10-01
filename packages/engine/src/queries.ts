// Read-only rule queries. These accept the minimal shape they need (`BoardLike`) so the
// mobile client can call them on its redacted PlayerView to highlight legal spots.

import { AWARD_VP, PIECES } from './constants.ts';
import { topology } from './geometry.ts';
import type { Board, Building, HarborKind, Resource, Seat } from './types.ts';
import { RESOURCES } from './types.ts';

export interface BoardLike {
  board: Board;
  buildings: (Building | null)[];
  trails: (Seat | null)[];
  raiderHex: number;
}

/** Harbor kinds reachable from each vertex. */
export function vertexHarborMap(board: Board): Map<number, HarborKind> {
  const topo = topology();
  const map = new Map<number, HarborKind>();
  for (const h of board.harbors) {
    for (const v of topo.edges[h.edge].vertices) map.set(v, h.kind);
  }
  return map;
}

/** Best bank rate per resource for a seat: 4 by default, 3 with a generic harbor, 2 with a matching one. */
export function harborRates(s: BoardLike, seat: Seat): Record<Resource, number> {
  const rates = { timber: 4, clay: 4, fleece: 4, grain: 4, stone: 4 } as Record<Resource, number>;
  for (const [v, kind] of vertexHarborMap(s.board)) {
    if (s.buildings[v]?.owner !== seat) continue;
    if (kind === 'any') {
      for (const r of RESOURCES) rates[r] = Math.min(rates[r], 3);
    } else {
      rates[kind] = 2;
    }
  }
  return rates;
}

/** Distance rule: vertex and all its neighbours must be empty. */
export function isVertexFree(s: BoardLike, v: number): boolean {
  const topo = topology();
  if (s.buildings[v]) return false;
  return topo.vertices[v].neighbors.every((n) => !s.buildings[n]);
}

function vertexBlockedFor(s: BoardLike, v: number, seat: Seat): boolean {
  const b = s.buildings[v];
  return !!b && b.owner !== seat;
}

/** Valid vertices for a setup-phase outpost (no trail connection needed). */
export function validSetupOutposts(s: BoardLike): number[] {
  return topology().vertices.filter((v) => isVertexFree(s, v.id)).map((v) => v.id);
}

/** Valid vertices for a regular outpost: distance rule + touching own trail. */
export function validOutposts(s: BoardLike, seat: Seat): number[] {
  const topo = topology();
  return topo.vertices
    .filter((v) => isVertexFree(s, v.id) && v.edges.some((e) => s.trails[e] === seat))
    .map((v) => v.id);
}

/** Own outposts that can be upgraded to towns. */
export function validTowns(s: BoardLike, seat: Seat): number[] {
  const out: number[] = [];
  s.buildings.forEach((b, v) => {
    if (b && b.owner === seat && b.kind === 'outpost') out.push(v);
  });
  return out;
}

/**
 * Valid edges for a trail. A trail must touch the player's building, or the player's trail
 * through a vertex that isn't occupied by an opponent's building.
 * If `fromVertex` is given (setup phase), the trail must touch that vertex.
 */
export function validTrails(s: BoardLike, seat: Seat, fromVertex: number | null = null): number[] {
  const topo = topology();
  const out: number[] = [];
  for (const edge of topo.edges) {
    if (s.trails[edge.id] !== null) continue;
    if (fromVertex !== null) {
      if (edge.vertices.includes(fromVertex)) out.push(edge.id);
      continue;
    }
    const connects = edge.vertices.some((v) => {
      if (s.buildings[v]?.owner === seat) return true;
      if (vertexBlockedFor(s, v, seat)) return false;
      return topo.vertices[v].edges.some((e) => e !== edge.id && s.trails[e] === seat);
    });
    if (connects) out.push(edge.id);
  }
  return out;
}

/** Hexes the raider may move to (any hex except its current one). */
export function validRaiderHexes(s: BoardLike): number[] {
  return topology()
    .hexes.filter((h) => h.id !== s.raiderHex)
    .map((h) => h.id);
}

/** Opponents with a building on `hex` and at least one card. */
export function raiderVictims(s: BoardLike, seat: Seat, hex: number, handCount: (seat: Seat) => number): Seat[] {
  const victims = new Set<Seat>();
  for (const v of topology().hexes[hex].vertices) {
    const b = s.buildings[v];
    if (b && b.owner !== seat && handCount(b.owner) > 0) victims.add(b.owner);
  }
  return [...victims].sort((a, b) => a - b);
}

/**
 * Longest continuous trail for a seat. A trail may revisit vertices but never reuse an edge,
 * and cannot pass *through* a vertex occupied by an opponent's building.
 */
export function longestTrail(s: BoardLike, seat: Seat): number {
  const topo = topology();
  const owned = topo.edges.filter((e) => s.trails[e.id] === seat).map((e) => e.id);
  if (owned.length === 0) return 0;
  const used = new Set<number>();
  let best = 0;

  const dfs = (vertex: number, length: number) => {
    best = Math.max(best, length);
    // Can't continue through an opponent's building (but a trail may end there).
    if (length > 0 && vertexBlockedFor(s, vertex, seat)) return;
    for (const e of topo.vertices[vertex].edges) {
      if (used.has(e) || s.trails[e] !== seat) continue;
      used.add(e);
      const [a, b] = topo.edges[e].vertices;
      dfs(a === vertex ? b : a, length + 1);
      used.delete(e);
    }
  };

  const starts = new Set<number>();
  for (const e of owned) for (const v of topo.edges[e].vertices) starts.add(v);
  for (const v of starts) dfs(v, 0);
  return best;
}

/** Points visible to everyone: buildings + awards. */
export function publicVictoryPoints(
  s: BoardLike & { longestTrail: { holder: Seat | null }; grandWatch: { holder: Seat | null } },
  seat: Seat,
): number {
  let vp = 0;
  for (const b of s.buildings) if (b && b.owner === seat) vp += b.kind === 'town' ? 2 : 1;
  if (s.longestTrail.holder === seat) vp += AWARD_VP;
  if (s.grandWatch.holder === seat) vp += AWARD_VP;
  return vp;
}

export function piecesUsed(s: BoardLike, seat: Seat) {
  let outposts = 0;
  let towns = 0;
  for (const b of s.buildings) {
    if (b?.owner !== seat) continue;
    if (b.kind === 'outpost') outposts++;
    else towns++;
  }
  const trails = s.trails.filter((t) => t === seat).length;
  return { trails, outposts, towns, maxTrails: PIECES.trails, maxOutposts: PIECES.outposts, maxTowns: PIECES.towns };
}
