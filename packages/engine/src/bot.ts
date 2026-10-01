// A simple, deterministic heuristic bot. It plays from a PlayerView (so it only sees what
// a human in its seat would see). Used for practice games, local simulation and fuzz tests.

import { COSTS, PIPS, TERRAIN_RESOURCE, emptyCounts, hasCards, totalCards } from './constants.ts';
import { topology } from './geometry.ts';
import {
  harborRates,
  isVertexFree,
  raiderVictims,
  validOutposts,
  validRaiderHexes,
  validSetupOutposts,
  validTowns,
  validTrails,
  vertexHarborMap,
} from './queries.ts';
import type { Action, Resource, ResourceCounts, Seat } from './types.ts';
import { RESOURCES } from './types.ts';
import type { PlayerView } from './view.ts';

function vertexScore(v: PlayerView, vertex: number): number {
  const topo = topology();
  const seen = new Set<Resource>();
  let score = 0;
  for (const h of topo.vertices[vertex].hexes) {
    const tile = v.board.hexes[h];
    const res = TERRAIN_RESOURCE[tile.terrain];
    if (!res || tile.token === null) continue;
    score += PIPS[tile.token] * (h === v.raiderHex ? 0.3 : 1);
    if (!seen.has(res)) score += 1.5;
    seen.add(res);
  }
  if (vertexHarborMap(v.board).has(vertex)) score += 1;
  return score;
}

function best<T>(items: T[], score: (t: T) => number): T | null {
  let top: T | null = null;
  let topScore = -Infinity;
  for (const it of items) {
    const sc = score(it);
    if (sc > topScore) {
      top = it;
      topScore = sc;
    }
  }
  return top;
}

/** How promising an edge is for expansion: best free spot within two steps. */
function edgeScore(v: PlayerView, edge: number, seat: Seat): number {
  const topo = topology();
  let score = 0;
  for (const end of topo.edges[edge].vertices) {
    if (isVertexFree(v, end)) score = Math.max(score, vertexScore(v, end));
    for (const n of topo.vertices[end].neighbors) {
      if (isVertexFree(v, n)) score = Math.max(score, vertexScore(v, n) * 0.6);
    }
    if (v.buildings[end] && v.buildings[end]!.owner !== seat) score -= 2;
  }
  return score;
}

function playable(v: PlayerView, seat: Seat, kind: string): boolean {
  const me = v.players[seat];
  return !v.fortunePlayedThisTurn && !!me.fortune?.some((c) => c.kind === kind && c.boughtOnTurn < v.turn);
}

function needFor(hand: ResourceCounts, cost: ResourceCounts): ResourceCounts {
  const need = emptyCounts();
  for (const r of RESOURCES) need[r] = Math.max(0, cost[r] - hand[r]);
  return need;
}

/** Returns the bot's next action, or null if it has nothing to do right now. */
export function chooseBotAction(v: PlayerView, seat: Seat): Action | null {
  const phase = v.phase;
  const me = v.players[seat];
  const hand = me.hand ?? emptyCounts();
  if (phase.kind === 'ended') return null;

  // Things a bot answers even when it's not its turn.
  if (phase.kind === 'discard' && phase.pending[seat] !== undefined) {
    const n = phase.pending[seat];
    const h = { ...hand };
    const out = emptyCounts();
    for (let i = 0; i < n; i++) {
      const r = best(
        RESOURCES.filter((x) => h[x] > 0),
        (x) => h[x] * 10 - RESOURCES.indexOf(x),
      )!;
      h[r]--;
      out[r]++;
    }
    return { type: 'discard', cards: out };
  }
  const incoming = v.offers.find((o) => o.to.includes(seat) && !o.declined.includes(seat));
  if (incoming) {
    const gain = RESOURCES.some((r) => incoming.give[r] > 0 && hand[r] === 0);
    const affordable = hasCards(hand, incoming.get);
    const cheap = RESOURCES.every((r) => incoming.get[r] === 0 || hand[r] - incoming.get[r] >= 1);
    const accept = phase.kind === 'main' && gain && affordable && cheap && totalCards(incoming.get) <= totalCards(incoming.give) + 1;
    return { type: 'respondTrade', offerId: incoming.id, accept };
  }

  if (v.currentSeat !== seat) return null;

  switch (phase.kind) {
    case 'setup': {
      if (phase.step === 'outpost') {
        return { type: 'placeSetupOutpost', vertex: best(validSetupOutposts(v), (x) => vertexScore(v, x))! };
      }
      return { type: 'placeSetupTrail', edge: best(validTrails(v, seat, phase.lastOutpost), (e) => edgeScore(v, e, seat))! };
    }
    case 'roll': {
      const raiderOnMe = topology().hexes[v.raiderHex].vertices.some((x) => v.buildings[x]?.owner === seat);
      if (raiderOnMe && playable(v, seat, 'warden')) return { type: 'playWarden' };
      return { type: 'roll' };
    }
    case 'discard':
      return null; // waiting on others
    case 'raider': {
      const leader = (s: Seat) => v.players[s].publicVP + v.players[s].handCount * 0.2;
      const hex = best(validRaiderHexes(v), (h) => {
        const tile = v.board.hexes[h];
        let sc = tile.token ? PIPS[tile.token] * 0.1 : -1;
        for (const x of topology().hexes[h].vertices) {
          const b = v.buildings[x];
          if (!b) continue;
          if (b.owner === seat) sc -= 100;
          else sc += (b.kind === 'town' ? 2 : 1) * (tile.token ? PIPS[tile.token] : 0) * (1 + leader(b.owner) * 0.1);
        }
        return sc;
      })!;
      const victims = raiderVictims(v, seat, hex, (s) => v.players[s].handCount);
      return { type: 'moveRaider', hex, victim: best(victims, (s) => v.players[s].handCount) };
    }
    case 'trailblazer': {
      return { type: 'buildTrail', edge: best(validTrails(v, seat), (e) => edgeScore(v, e, seat))! };
    }
    case 'main':
      return mainPhase(v, seat, hand);
  }
}

function mainPhase(v: PlayerView, seat: Seat, hand: ResourceCounts): Action {
  const me = v.players[seat];
  const towns = validTowns(v, seat);
  if (me.townsLeft > 0 && towns.length && hasCards(hand, COSTS.town)) {
    return { type: 'buildTown', vertex: best(towns, (x) => vertexScore(v, x))! };
  }
  const spots = me.outpostsLeft > 0 ? validOutposts(v, seat) : [];
  if (spots.length && hasCards(hand, COSTS.outpost)) {
    return { type: 'buildOutpost', vertex: best(spots, (x) => vertexScore(v, x))! };
  }

  // Pick a goal and look at what's missing.
  const goal = towns.length && me.townsLeft > 0 ? COSTS.town : spots.length ? COSTS.outpost : me.outpostsLeft > 0 ? COSTS.trail : COSTS.fortune;
  const need = needFor(hand, goal);
  const missing = RESOURCES.filter((r) => need[r] > 0);

  if (playable(v, seat, 'windfall') && missing.length) {
    const a = missing[0];
    const b = need[a] >= 2 ? a : (missing[1] ?? a);
    if (v.bank[a] >= (a === b ? 2 : 1) && v.bank[b] >= 1) return { type: 'playWindfall', resources: [a, b] };
  }
  if (playable(v, seat, 'embargo') && missing.length) return { type: 'playEmbargo', resource: missing[0] };
  if (playable(v, seat, 'trailblazer') && me.trailsLeft > 0 && validTrails(v, seat).length) return { type: 'playTrailblazer' };
  if (playable(v, seat, 'warden')) {
    const raiderOnMe = topology().hexes[v.raiderHex].vertices.some((x) => v.buildings[x]?.owner === seat);
    if (raiderOnMe || me.wardensPlayed >= 2) return { type: 'playWarden' };
  }

  const trails = me.trailsLeft > 0 ? validTrails(v, seat) : [];
  if (!spots.length && me.outpostsLeft > 0 && trails.length && hasCards(hand, COSTS.trail)) {
    const edge = best(trails, (e) => edgeScore(v, e, seat))!;
    if (edgeScore(v, edge, seat) > 0) return { type: 'buildTrail', edge };
  }

  // Harbor/bank trade toward the goal using surplus cards.
  if (missing.length) {
    const rates = harborRates(v, seat);
    const surplus = best(
      RESOURCES.filter((r) => hand[r] - goal[r] >= rates[r]),
      (r) => hand[r] - goal[r] - rates[r],
    );
    const want = missing.find((r) => v.bank[r] > 0);
    if (surplus && want) return { type: 'harborTrade', give: surplus, get: want };
  }

  if (v.deckCount > 0 && hasCards(hand, COSTS.fortune) && (goal === COSTS.fortune || totalCards(hand) > 7)) {
    return { type: 'buyFortune' };
  }
  return { type: 'endTurn' };
}

