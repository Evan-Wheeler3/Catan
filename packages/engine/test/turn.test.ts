import { describe, expect, it } from 'vitest';
import { applyAction, counts, topology, totalCards, type GameState } from '../src/index.ts';
import { act, bankPlusHands, give, hexWithToken, mainPhase, placeOutpost, rejectCode, rigDice } from './helpers.ts';

function rollPhase(s: GameState): GameState {
  return { ...s, phase: { kind: 'roll' }, dice: null };
}

describe('production', () => {
  it('pays 1 per outpost and 2 per town on matching hexes', () => {
    let s = mainPhase(3);
    const hex = hexWithToken(s, 8);
    const [v0, , v2] = topology().hexes[hex].vertices;
    placeOutpost(s, 1, v0);
    placeOutpost(s, 2, v2, 'town');
    const res = s.board.hexes[hex].terrain;
    s = rigDice(rollPhase(s), 8);
    const { state, events } = act(s, 0, { type: 'roll' });
    const resource = { grove: 'timber', claypit: 'clay', meadow: 'fleece', fields: 'grain', crags: 'stone' }[res as 'grove']!;
    expect(state.players[1].hand[resource as 'timber']).toBeGreaterThanOrEqual(1);
    expect(state.players[2].hand[resource as 'timber']).toBeGreaterThanOrEqual(2);
    expect(events.some((e) => e.type === 'produced')).toBe(true);
    expect(state.phase.kind).toBe('main');
  });

  it('does not produce on the Raider hex', () => {
    let s = mainPhase(3);
    const hex = hexWithToken(s, 6);
    for (const h of [hex]) placeOutpost(s, 1, topology().hexes[h].vertices[0]);
    s.raiderHex = hex;
    // Remove the other 6 so only the raided hex matters.
    const other = hexWithToken(s, 6, [hex]);
    s.board.hexes[other].token = 12;
    s = rigDice(rollPhase(s), 6);
    const { state } = act(s, 0, { type: 'roll' });
    expect(totalCards(state.players[1].hand)).toBe(0);
  });

  it('applies the bank-shortage rule', () => {
    let s = mainPhase(3);
    const hex = hexWithToken(s, 5);
    const other = hexWithToken(s, 5, [hex]);
    s.board.hexes[other].token = 12;
    const res = ({ grove: 'timber', claypit: 'clay', meadow: 'fleece', fields: 'grain', crags: 'stone' } as const)[
      s.board.hexes[hex].terrain as 'grove'
    ];
    const [a, , c] = topology().hexes[hex].vertices;
    placeOutpost(s, 1, a, 'town');
    placeOutpost(s, 2, c);
    // Bank has only 2 left: three owed between two players → nobody gets any.
    s.bank[res] = 2;
    s = rigDice(rollPhase(s), 5);
    let out = act(s, 0, { type: 'roll' });
    expect(out.state.players[1].hand[res]).toBe(0);
    expect(out.state.players[2].hand[res]).toBe(0);
    expect(out.events.find((e) => e.type === 'produced')).toMatchObject({ blocked: [res] });

    // Single claimant gets whatever is left.
    s.buildings[c] = null;
    s.bank[res] = 1;
    out = act(s, 0, { type: 'roll' });
    expect(out.state.players[1].hand[res]).toBe(1);
    expect(out.state.bank[res]).toBe(0);
  });
});

describe('rolling a 7', () => {
  function sevenState() {
    let s = mainPhase(4);
    give(s, 0, { timber: 4, clay: 4 }); // 8 → discard 4
    give(s, 1, { grain: 7 }); // 7 → safe
    give(s, 2, { stone: 5, fleece: 4 }); // 9 → discard 4
    s = rigDice(rollPhase(s), 7);
    return act(s, 0, { type: 'roll' });
  }

  it('asks players with more than seven cards to discard half, rounded down', () => {
    const { state, events } = sevenState();
    expect(state.phase).toEqual({ kind: 'discard', pending: { 0: 4, 2: 4 } });
    expect(events.map((e) => e.type)).toEqual(['diceRolled', 'discardRequired']);
  });

  it('collects discards from anyone, in any order, then moves to the Raider', () => {
    let { state: s } = sevenState();
    expect(rejectCode(s, 1, { type: 'discard', cards: counts({ grain: 3 }) })).toBe('no_discard');
    expect(rejectCode(s, 2, { type: 'discard', cards: counts({ stone: 3 }) })).toBe('wrong_count');
    expect(rejectCode(s, 2, { type: 'discard', cards: counts({ timber: 4 }) })).toBe('cannot_afford');
    expect(rejectCode(s, 0, { type: 'endTurn' })).toBe('wrong_phase');
    s = act(s, 2, { type: 'discard', cards: counts({ stone: 2, fleece: 2 }) }).state;
    expect(s.phase.kind).toBe('discard');
    s = act(s, 0, { type: 'discard', cards: counts({ timber: 4 }) }).state;
    expect(s.phase).toEqual({ kind: 'raider', returnTo: 'main' });
    expect(totalCards(s.players[0].hand)).toBe(4);
    expect(bankPlusHands(s)).toEqual(counts({ timber: 19, clay: 19, fleece: 19, grain: 19, stone: 19 }));
  });

  it('skips discarding when nobody is over the limit', () => {
    let s = mainPhase(3);
    give(s, 1, { grain: 7 });
    s = rigDice(rollPhase(s), 7);
    expect(act(s, 0, { type: 'roll' }).state.phase).toEqual({ kind: 'raider', returnTo: 'main' });
  });
});

describe('the Raider', () => {
  function raiderState() {
    const s = mainPhase(4);
    s.phase = { kind: 'raider', returnTo: 'main' };
    return s;
  }

  it('must move to a different tile', () => {
    const s = raiderState();
    expect(rejectCode(s, 0, { type: 'moveRaider', hex: s.raiderHex })).toBe('same_hex');
  });

  it('steals one random card from a chosen adjacent victim', () => {
    const s = raiderState();
    const hex = (s.raiderHex + 1) % 19;
    const [a, , c] = topology().hexes[hex].vertices;
    placeOutpost(s, 1, a);
    placeOutpost(s, 2, c);
    give(s, 1, { clay: 2 });
    give(s, 2, { stone: 1 });
    give(s, 3, { grain: 3 });
    expect(rejectCode(s, 0, { type: 'moveRaider', hex })).toBe('bad_victim');
    expect(rejectCode(s, 0, { type: 'moveRaider', hex, victim: 3 })).toBe('bad_victim');
    const { state, events } = act(s, 0, { type: 'moveRaider', hex, victim: 2 });
    expect(state.raiderHex).toBe(hex);
    expect(state.players[2].hand.stone).toBe(0);
    expect(state.players[0].hand.stone).toBe(1);
    expect(events).toContainEqual({ type: 'stole', thief: 0, victim: 2, resource: 'stone' });
    expect(state.phase.kind).toBe('main');
  });

  it('auto-picks a single victim and ignores players with no cards', () => {
    const s = raiderState();
    const hex = (s.raiderHex + 1) % 19;
    const [a, , c] = topology().hexes[hex].vertices;
    placeOutpost(s, 1, a);
    placeOutpost(s, 2, c);
    give(s, 1, { clay: 1 });
    const { state } = act(s, 0, { type: 'moveRaider', hex });
    expect(state.players[0].hand.clay).toBe(1);
  });

  it('steals nothing when nobody is adjacent', () => {
    const s = raiderState();
    const hex = (s.raiderHex + 1) % 19;
    const { events } = act(s, 0, { type: 'moveRaider', hex, victim: 2 });
    expect(events.map((e) => e.type)).toEqual(['raiderMoved']);
  });
});

describe('building', () => {
  it('charges costs and enforces trail connection', () => {
    const s = mainPhase(3);
    const topo = topology();
    placeOutpost(s, 0, 20);
    const edge = topo.vertices[20].edges[0];
    expect(rejectCode(s, 0, { type: 'buildTrail', edge })).toBe('cannot_afford');
    give(s, 0, { timber: 1, clay: 1 });
    const far = topo.edges.find((e) => !e.vertices.some((v) => topo.vertices[20].neighbors.includes(v) || v === 20))!;
    expect(rejectCode(s, 0, { type: 'buildTrail', edge: far.id })).toBe('not_connected');
    const { state } = act(s, 0, { type: 'buildTrail', edge });
    expect(state.trails[edge]).toBe(0);
    expect(totalCards(state.players[0].hand)).toBe(0);
    expect(state.players[0].trailsLeft).toBe(14);
  });

  it("can't extend a trail through an opponent's outpost", () => {
    const s = mainPhase(3);
    const topo = topology();
    // 0's trail runs a→b; opponent sits on b.
    const a = 20;
    const b = topo.vertices[a].neighbors[0];
    placeOutpost(s, 0, a);
    s.trails[topo.edges.find((e) => e.vertices.includes(a) && e.vertices.includes(b))!.id] = 0;
    placeOutpost(s, 1, b);
    give(s, 0, { timber: 1, clay: 1 });
    const beyond = topo.vertices[b].edges.find((e) => !topo.edges[e].vertices.includes(a))!;
    expect(rejectCode(s, 0, { type: 'buildTrail', edge: beyond })).toBe('not_connected');
  });

  it('requires outposts to touch your trail and respect distance', () => {
    const s = mainPhase(3);
    const topo = topology();
    const a = 20;
    const b = topo.vertices[a].neighbors[0];
    const c = topo.vertices[b].neighbors.find((x) => x !== a)!;
    placeOutpost(s, 0, a);
    s.trails[topo.edges.find((e) => e.vertices.includes(a) && e.vertices.includes(b))!.id] = 0;
    give(s, 0, { timber: 2, clay: 2, fleece: 2, grain: 2 });
    expect(rejectCode(s, 0, { type: 'buildOutpost', vertex: b })).toBe('too_close');
    expect(rejectCode(s, 0, { type: 'buildOutpost', vertex: c })).toBe('not_connected');
    s.trails[topo.edges.find((e) => e.vertices.includes(b) && e.vertices.includes(c))!.id] = 0;
    const { state } = act(s, 0, { type: 'buildOutpost', vertex: c });
    expect(state.buildings[c]).toEqual({ owner: 0, kind: 'outpost' });
  });

  it('upgrades outposts to towns and returns the outpost piece', () => {
    const s = mainPhase(3);
    placeOutpost(s, 0, 20);
    give(s, 0, { grain: 2, stone: 3 });
    expect(rejectCode(s, 0, { type: 'buildTown', vertex: 21 })).toBe('not_outpost');
    const before = s.players[0].outpostsLeft;
    const { state } = act(s, 0, { type: 'buildTown', vertex: 20 });
    expect(state.buildings[20]?.kind).toBe('town');
    expect(state.players[0].outpostsLeft).toBe(before + 1);
    expect(state.players[0].townsLeft).toBe(3);
  });

  it('enforces piece limits', () => {
    const s = mainPhase(3);
    placeOutpost(s, 0, 20);
    s.players[0].trailsLeft = 0;
    give(s, 0, { timber: 1, clay: 1 });
    expect(rejectCode(s, 0, { type: 'buildTrail', edge: topology().vertices[20].edges[0] })).toBe('no_pieces');
  });

  it('only lets the current player build', () => {
    const s = mainPhase(3);
    expect(rejectCode(s, 1, { type: 'buyFortune' })).toBe('not_your_turn');
  });

  it('passes the turn and resets per-turn state', () => {
    const s = mainPhase(3);
    s.fortunePlayedThisTurn = true;
    const { state, events } = act(s, 0, { type: 'endTurn' });
    expect(state.currentSeat).toBe(1);
    expect(state.turn).toBe(2);
    expect(state.phase.kind).toBe('roll');
    expect(state.fortunePlayedThisTurn).toBe(false);
    expect(events.map((e) => e.type)).toEqual(['turnEnded', 'turnStarted']);
    expect(applyAction(state, 1, { type: 'endTurn' }).ok).toBe(false);
  });
});
