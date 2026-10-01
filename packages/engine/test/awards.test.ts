import { describe, expect, it } from 'vitest';
import { counts, longestTrail, topology, type GameState } from '../src/index.ts';
import { act, edgeBetween, give, mainPhase, placeOutpost, placeTrail, rejectCode, simplePath } from './helpers.ts';

/** Gives `seat` an outpost at `start` and trails along all but the last edge of the path. */
function almostTrail(s: GameState, seat: number, path: { vertices: number[]; edges: number[] }) {
  placeOutpost(s, seat, path.vertices[0]);
  for (const e of path.edges.slice(0, -1)) placeTrail(s, seat, e);
}

/** Finds a 6-edge path whose middle vertex has a third free neighbour (so it can be cut). */
function cuttablePath() {
  const topo = topology();
  for (const v of topo.vertices) {
    try {
      const path = simplePath(v.id, 6);
      const mid = path.vertices[3];
      const side = topo.vertices[mid].neighbors.find((n) => !path.vertices.includes(n));
      if (side !== undefined && topo.vertices[side].neighbors.every((n) => n === mid || !path.vertices.includes(n))) {
        return { path, mid, side };
      }
    } catch {
      /* try next */
    }
  }
  throw new Error('no cuttable path');
}

describe('longestTrail()', () => {
  it('counts a simple chain', () => {
    const s = mainPhase(3);
    const path = simplePath(0, 5);
    for (const e of path.edges) placeTrail(s, 0, e);
    expect(longestTrail(s, 0)).toBe(5);
    expect(longestTrail(s, 1)).toBe(0);
  });

  it('counts a closed loop plus a tail', () => {
    const s = mainPhase(3);
    const center = topology().hexes.find((h) => h.q === 0 && h.r === 0)!;
    for (const e of center.edges) placeTrail(s, 0, e);
    expect(longestTrail(s, 0)).toBe(6);
    const corner = center.vertices[0];
    const tail = topology().vertices[corner].edges.find((e) => !center.edges.includes(e))!;
    placeTrail(s, 0, tail);
    expect(longestTrail(s, 0)).toBe(7);
  });

  it('takes the longest branch through a fork', () => {
    const s = mainPhase(3);
    const topo = topology();
    const hub = topo.vertices.find((v) => v.neighbors.length === 3 && v.hexes.length === 3)!;
    // Branches of length 2, 2, and 1 from the hub → best path is 2 + 2 = 4.
    const [a, b, c] = hub.neighbors;
    placeTrail(s, 0, edgeBetween(hub.id, a));
    placeTrail(s, 0, edgeBetween(hub.id, b));
    placeTrail(s, 0, edgeBetween(hub.id, c));
    const extA = topo.vertices[a].neighbors.find((n) => n !== hub.id)!;
    const extB = topo.vertices[b].neighbors.find((n) => n !== hub.id)!;
    placeTrail(s, 0, edgeBetween(a, extA));
    placeTrail(s, 0, edgeBetween(b, extB));
    expect(longestTrail(s, 0)).toBe(4);
  });

  it("stops at an opponent's building but counts the trail into it", () => {
    const s = mainPhase(3);
    const path = simplePath(0, 3);
    for (const e of path.edges) placeTrail(s, 0, e);
    placeOutpost(s, 1, path.vertices[2]);
    expect(longestTrail(s, 0)).toBe(2);
  });

  it("is not broken by the player's own buildings", () => {
    const s = mainPhase(3);
    const path = simplePath(0, 4);
    for (const e of path.edges) placeTrail(s, 0, e);
    placeOutpost(s, 0, path.vertices[2]);
    expect(longestTrail(s, 0)).toBe(4);
  });
});

describe('Longest Trail award', () => {
  it('needs at least five segments', () => {
    const s = mainPhase(3);
    const path = simplePath(0, 4);
    almostTrail(s, 0, path);
    give(s, 0, { timber: 1, clay: 1 });
    const { state } = act(s, 0, { type: 'buildTrail', edge: path.edges[3] });
    expect(state.longestTrail.holder).toBeNull();
  });

  it('is claimed at five and announced', () => {
    const s = mainPhase(3);
    const path = simplePath(0, 5);
    almostTrail(s, 0, path);
    give(s, 0, { timber: 1, clay: 1 });
    const { state, events } = act(s, 0, { type: 'buildTrail', edge: path.edges[4] });
    expect(state.longestTrail).toEqual({ holder: 0, size: 5 });
    expect(events).toContainEqual({ type: 'awardChanged', award: 'longestTrail', holder: 0, previous: null, size: 5 });
  });

  it('stays with the holder on a tie and moves on a strictly longer trail', () => {
    const s = mainPhase(3);
    const topo = topology();
    const mine = simplePath(0, 5);
    for (const e of mine.edges) placeTrail(s, 0, e);
    s.longestTrail = { holder: 0, size: 5 };
    const used = new Set(mine.vertices.flatMap((v) => [v, ...topo.vertices[v].neighbors]));
    const start = topo.vertices.find((v) => !used.has(v.id) && v.neighbors.every((n) => !used.has(n)))!.id;
    const theirs = simplePath(start, 6, used);
    almostTrail(s, 1, { vertices: theirs.vertices, edges: theirs.edges.slice(0, 5) });
    s.currentSeat = 1;
    give(s, 1, { timber: 2, clay: 2 });
    let out = act(s, 1, { type: 'buildTrail', edge: theirs.edges[4] });
    expect(out.state.longestTrail.holder).toBe(0); // 5 vs 5
    out = act(out.state, 1, { type: 'buildTrail', edge: theirs.edges[5] });
    expect(out.state.longestTrail).toEqual({ holder: 1, size: 6 });
  });

  it('moves when an opponent outpost cuts the holder’s trail', () => {
    const s = mainPhase(3);
    const topo = topology();
    const { path, mid, side } = cuttablePath();
    for (const e of path.edges) placeTrail(s, 0, e);
    s.longestTrail = { holder: 0, size: 6 };
    // Seat 1 has a five-trail elsewhere and a spur reaching the cut point.
    const used = new Set(path.vertices.flatMap((v) => [v, ...topo.vertices[v].neighbors]));
    used.add(side);
    for (const n of topo.vertices[side].neighbors) used.add(n);
    const other = topo.vertices.find((v) => !used.has(v.id) && v.neighbors.every((n) => !used.has(n)))!.id;
    for (const e of simplePath(other, 5, used).edges) placeTrail(s, 1, e);
    placeTrail(s, 1, edgeBetween(side, mid));
    s.currentSeat = 1;
    give(s, 1, { timber: 1, clay: 1, fleece: 1, grain: 1 });
    const { state, events } = act(s, 1, { type: 'buildOutpost', vertex: mid });
    expect(longestTrail(state, 0)).toBe(3);
    expect(state.longestTrail).toEqual({ holder: 1, size: 5 });
    expect(events).toContainEqual({ type: 'awardChanged', award: 'longestTrail', holder: 1, previous: 0, size: 5 });
  });

  it('is set aside when the cut leaves a tie between other players', () => {
    const s = mainPhase(4);
    const topo = topology();
    const { path, mid, side } = cuttablePath();
    for (const e of path.edges) placeTrail(s, 0, e);
    s.longestTrail = { holder: 0, size: 6 };
    const used = new Set(path.vertices.flatMap((v) => [v, ...topo.vertices[v].neighbors]));
    used.add(side);
    for (const n of topo.vertices[side].neighbors) used.add(n);
    for (const seat of [1, 2]) {
      const start = topo.vertices.find((v) => !used.has(v.id) && v.neighbors.every((n) => !used.has(n)))!.id;
      const p = simplePath(start, 5, used);
      for (const e of p.edges) placeTrail(s, seat, e);
      for (const v of p.vertices) {
        used.add(v);
        for (const n of topo.vertices[v].neighbors) used.add(n);
      }
    }
    expect(longestTrail(s, 1)).toBe(5);
    expect(longestTrail(s, 2)).toBe(5);
    placeTrail(s, 3, edgeBetween(side, mid));
    s.currentSeat = 3;
    give(s, 3, { timber: 1, clay: 1, fleece: 1, grain: 1 });
    const { state } = act(s, 3, { type: 'buildOutpost', vertex: mid });
    expect(state.longestTrail.holder).toBeNull();
  });
});

describe('Grand Watch award', () => {
  function withWarden(s: GameState, seat: number, played: number) {
    s.players[seat].wardensPlayed = played;
    s.players[seat].fortune.push({ id: 900 + seat, kind: 'warden', boughtOnTurn: 0 });
  }

  it('is claimed with the third Warden', () => {
    const s = mainPhase(3);
    withWarden(s, 0, 2);
    const { state, events } = act(s, 0, { type: 'playWarden' });
    expect(state.grandWatch).toEqual({ holder: 0, size: 3 });
    expect(events.some((e) => e.type === 'awardChanged' && e.award === 'grandWatch')).toBe(true);
    expect(state.phase).toEqual({ kind: 'raider', returnTo: 'main' });
  });

  it('only changes hands when someone strictly exceeds the holder', () => {
    let s = mainPhase(3);
    s.grandWatch = { holder: 1, size: 3 };
    s.players[1].wardensPlayed = 3;
    withWarden(s, 0, 2);
    s = act(s, 0, { type: 'playWarden' }).state;
    expect(s.grandWatch.holder).toBe(1);
    s.fortunePlayedThisTurn = false;
    s.phase = { kind: 'main' };
    withWarden(s, 0, 3);
    s = act(s, 0, { type: 'playWarden' }).state;
    expect(s.grandWatch).toEqual({ holder: 0, size: 4 });
  });
});

describe('victory', () => {
  it('ends the game when the current player reaches 10', () => {
    const s = mainPhase(3);
    // 4 towns (8) + 1 outpost (1) = 9 points.
    [0, 10, 25, 40].forEach((v) => placeOutpost(s, 0, v, 'town'));
    placeOutpost(s, 0, 50);
    s.players[0].fortune.push({ id: 1, kind: 'relic', boughtOnTurn: 0 });
    // 9 public + 1 hidden relic = 10, but nothing triggers until an action happens.
    give(s, 0, { fleece: 1, grain: 1, stone: 1 });
    s.fortuneDeck[0] = 'warden';
    const { state, events } = act(s, 0, { type: 'buyFortune' });
    expect(state.phase).toEqual({ kind: 'ended', winner: 0 });
    const won = events.find((e) => e.type === 'gameWon');
    expect(won).toMatchObject({ seat: 0, vp: 10, relics: [1, 0, 0] });
    expect(rejectCode(state, 1, { type: 'roll' })).toBe('game_over');
  });

  it('wins via a freshly bought hidden Relic', () => {
    const s = mainPhase(3);
    [0, 10, 25, 40].forEach((v) => placeOutpost(s, 0, v, 'town'));
    placeOutpost(s, 0, 50);
    give(s, 0, { fleece: 1, grain: 1, stone: 1 });
    s.fortuneDeck[0] = 'relic';
    const { state } = act(s, 0, { type: 'buyFortune' });
    expect(state.phase.kind).toBe('ended');
  });

  it("doesn't let a player win on someone else's turn, only once their turn starts", () => {
    let s = mainPhase(3);
    [0, 10, 25, 40].forEach((v) => placeOutpost(s, 1, v, 'town'));
    placeOutpost(s, 1, 50);
    s.longestTrail = { holder: 1, size: 5 };
    // Seat 1 has 11 points, but it's seat 0's turn.
    give(s, 0, { timber: 1 });
    give(s, 1, { clay: 1 });
    s = act(s, 0, { type: 'offerTrade', to: [1], give: counts({ timber: 1 }), get: counts({ clay: 1 }) }).state;
    s = act(s, 1, { type: 'respondTrade', offerId: s.offers[0].id, accept: true }).state;
    expect(s.phase.kind).toBe('main');
    const { state, events } = act(s, 0, { type: 'endTurn' });
    expect(state.phase).toEqual({ kind: 'ended', winner: 1 });
    expect(events.map((e) => e.type)).toEqual(['turnEnded', 'turnStarted', 'gameWon']);
  });
});
