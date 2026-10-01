import { describe, expect, it } from 'vitest';
import { counts, harborRates, topology, totalCards, validTrails, type GameState } from '../src/index.ts';
import { act, give, mainPhase, placeOutpost, rejectCode } from './helpers.ts';

function withCard(s: GameState, seat: number, kind: 'warden' | 'trailblazer' | 'windfall' | 'embargo' | 'relic', turn = 0) {
  s.players[seat].fortune.push({ id: 500 + s.players[seat].fortune.length, kind, boughtOnTurn: turn });
}

describe('Fortune cards', () => {
  it('can be bought for fleece + grain + stone', () => {
    const s = mainPhase(3);
    give(s, 0, { fleece: 1, grain: 1, stone: 1 });
    const top = s.fortuneDeck[0];
    const { state, events } = act(s, 0, { type: 'buyFortune' });
    expect(state.players[0].fortune).toHaveLength(1);
    expect(state.players[0].fortune[0].kind).toBe(top);
    expect(state.fortuneDeck).toHaveLength(24);
    expect(events[0]).toMatchObject({ type: 'fortuneBought', seat: 0, kind: top });
  });

  it("can't be played on the turn they were bought", () => {
    const s = mainPhase(3);
    withCard(s, 0, 'warden', 1);
    expect(rejectCode(s, 0, { type: 'playWarden' })).toBe('too_fresh');
  });

  it('allows only one per turn', () => {
    const s = mainPhase(3);
    withCard(s, 0, 'windfall');
    withCard(s, 0, 'embargo');
    const { state } = act(s, 0, { type: 'playWindfall', resources: ['stone', 'stone'] });
    expect(state.players[0].hand.stone).toBe(2);
    expect(rejectCode(state, 0, { type: 'playEmbargo', resource: 'grain' })).toBe('one_per_turn');
  });

  it('Warden can be played before rolling and returns to the roll', () => {
    let s = mainPhase(3);
    s.phase = { kind: 'roll' };
    withCard(s, 0, 'warden');
    s = act(s, 0, { type: 'playWarden' }).state;
    expect(s.phase).toEqual({ kind: 'raider', returnTo: 'roll' });
    s = act(s, 0, { type: 'moveRaider', hex: (s.raiderHex + 1) % 19 }).state;
    expect(s.phase.kind).toBe('roll');
    expect(s.players[0].wardensPlayed).toBe(1);
  });

  it('Trailblazer builds two free trails', () => {
    let s = mainPhase(3);
    placeOutpost(s, 0, 20);
    withCard(s, 0, 'trailblazer');
    s = act(s, 0, { type: 'playTrailblazer' }).state;
    expect(s.phase).toEqual({ kind: 'trailblazer', remaining: 2 });
    expect(rejectCode(s, 0, { type: 'endTurn' })).toBe('wrong_phase');
    s = act(s, 0, { type: 'buildTrail', edge: validTrails(s, 0)[0] }).state;
    s = act(s, 0, { type: 'buildTrail', edge: validTrails(s, 0)[0] }).state;
    expect(s.phase.kind).toBe('main');
    expect(s.players[0].trailsLeft).toBe(13);
    expect(totalCards(s.players[0].hand)).toBe(0);
  });

  it('Embargo collects every card of one resource from all opponents', () => {
    const s = mainPhase(4);
    withCard(s, 0, 'embargo');
    give(s, 1, { grain: 3, stone: 1 });
    give(s, 2, { grain: 1 });
    const { state, events } = act(s, 0, { type: 'playEmbargo', resource: 'grain' });
    expect(state.players[0].hand.grain).toBe(4);
    expect(state.players[1].hand).toEqual(counts({ stone: 1 }));
    expect(events[1]).toMatchObject({ type: 'embargoCollected', total: 4, from: { 1: 3, 2: 1 } });
  });

  it('Windfall respects an empty bank', () => {
    const s = mainPhase(3);
    withCard(s, 0, 'windfall');
    s.bank.clay = 1;
    expect(rejectCode(s, 0, { type: 'playWindfall', resources: ['clay', 'clay'] })).toBe('bank_empty');
    // The card is not consumed by a failed play.
    expect(act(s, 0, { type: 'playWindfall', resources: ['clay', 'timber'] }).state.players[0].fortune).toHaveLength(0);
  });
});

describe('harbors', () => {
  it('give 4:1 by default, 3:1 on a generic harbor and 2:1 on a matching one', () => {
    const s = mainPhase(3);
    const topo = topology();
    expect(harborRates(s, 0).timber).toBe(4);
    const generic = s.board.harbors.find((h) => h.kind === 'any')!;
    placeOutpost(s, 0, topo.edges[generic.edge].vertices[0]);
    expect(Object.values(harborRates(s, 0))).toEqual([3, 3, 3, 3, 3]);
    const special = s.board.harbors.find((h) => h.kind !== 'any')!;
    placeOutpost(s, 0, topo.edges[special.edge].vertices[1]);
    const rates = harborRates(s, 0);
    expect(rates[special.kind as 'timber']).toBe(2);
    expect(Object.values(rates).filter((r) => r === 3)).toHaveLength(4);
  });

  it('trades with the bank at the best available rate', () => {
    const s = mainPhase(3);
    give(s, 0, { timber: 5 });
    expect(rejectCode(s, 0, { type: 'harborTrade', give: 'timber', get: 'timber' })).toBe('bad_input');
    const { state, events } = act(s, 0, { type: 'harborTrade', give: 'timber', get: 'stone' });
    expect(state.players[0].hand).toEqual(counts({ timber: 1, stone: 1 }));
    expect(events[0]).toMatchObject({ giveCount: 4 });
    expect(rejectCode(state, 0, { type: 'harborTrade', give: 'timber', get: 'stone' })).toBe('cannot_afford');
  });
});

describe('player trades', () => {
  function tradeState() {
    const s = mainPhase(4);
    give(s, 0, { timber: 2 });
    give(s, 1, { grain: 1 });
    give(s, 2, { grain: 2 });
    return s;
  }

  it('persist until accepted, and swap cards', () => {
    let s = tradeState();
    s = act(s, 0, { type: 'offerTrade', to: [1, 2], give: counts({ timber: 1 }), get: counts({ grain: 1 }) }).state;
    expect(s.offers).toHaveLength(1);
    s = act(s, 1, { type: 'respondTrade', offerId: 1, accept: false }).state;
    expect(s.offers).toHaveLength(1);
    expect(rejectCode(s, 1, { type: 'respondTrade', offerId: 1, accept: true })).toBe('not_for_you');
    const { state, events } = act(s, 2, { type: 'respondTrade', offerId: 1, accept: true });
    expect(state.offers).toHaveLength(0);
    expect(state.players[0].hand).toEqual(counts({ timber: 1, grain: 1 }));
    expect(state.players[2].hand).toEqual(counts({ timber: 1, grain: 1 }));
    expect(events[0]).toMatchObject({ type: 'tradeResolved', outcome: 'accepted', by: 2 });
  });

  it('are removed once every recipient declines', () => {
    let s = tradeState();
    s = act(s, 0, { type: 'offerTrade', to: [1], give: counts({ timber: 1 }), get: counts({ grain: 1 }) }).state;
    s = act(s, 1, { type: 'respondTrade', offerId: 1, accept: false }).state;
    expect(s.offers).toHaveLength(0);
  });

  it('must involve the active player', () => {
    const s = tradeState();
    expect(rejectCode(s, 1, { type: 'offerTrade', to: [2], give: counts({ grain: 1 }), get: counts({ grain: 1 }) })).toBe('bad_trade');
    expect(rejectCode(s, 1, { type: 'offerTrade', to: [2], give: counts({ grain: 1 }), get: counts({ timber: 1 }) })).toBe('not_your_turn');
    const { state } = act(s, 1, { type: 'offerTrade', to: [0], give: counts({ grain: 1 }), get: counts({ timber: 1 }) });
    expect(act(state, 0, { type: 'respondTrade', offerId: 1, accept: true }).state.players[1].hand.timber).toBe(1);
  });

  it('validate what is on offer', () => {
    const s = tradeState();
    expect(rejectCode(s, 0, { type: 'offerTrade', to: [1], give: counts({ timber: 3 }), get: counts({ grain: 1 }) })).toBe('cannot_afford');
    expect(rejectCode(s, 0, { type: 'offerTrade', to: [1], give: counts({}), get: counts({ grain: 1 }) })).toBe('empty_trade');
    expect(rejectCode(s, 0, { type: 'offerTrade', to: [0], give: counts({ timber: 1 }), get: counts({ grain: 1 }) })).toBe('bad_input');
    expect(rejectCode(s, 0, { type: 'offerTrade', to: [1], give: { timber: -1 } as never, get: counts({ grain: 1 }) })).toBe('bad_input');
    expect(rejectCode(s, 0, { type: 'offerTrade', to: [1], give: { gold: 1 } as never, get: counts({ grain: 1 }) })).toBe('bad_input');
  });

  it('fall through gracefully if the proposer spent the cards', () => {
    let s = tradeState();
    s = act(s, 0, { type: 'offerTrade', to: [1], give: counts({ timber: 2 }), get: counts({ grain: 1 }) }).state;
    s.players[0].hand.timber = 0; // spent elsewhere
    const { state, events } = act(s, 1, { type: 'respondTrade', offerId: 1, accept: true });
    expect(events[0]).toMatchObject({ outcome: 'failed' });
    expect(state.players[1].hand.grain).toBe(1);
  });

  it('can be withdrawn, and expire when the turn ends', () => {
    let s = tradeState();
    s = act(s, 0, { type: 'offerTrade', to: [1], give: counts({ timber: 1 }), get: counts({ grain: 1 }) }).state;
    s = act(s, 0, { type: 'offerTrade', to: [2], give: counts({ timber: 1 }), get: counts({ grain: 1 }) }).state;
    expect(rejectCode(s, 1, { type: 'cancelTrade', offerId: 1 })).toBe('not_yours');
    s = act(s, 0, { type: 'cancelTrade', offerId: 1 }).state;
    expect(s.offers.map((o) => o.id)).toEqual([2]);
    const { state, events } = act(s, 0, { type: 'endTurn' });
    expect(state.offers).toHaveLength(0);
    expect(events[0]).toMatchObject({ type: 'tradeResolved', outcome: 'expired', offerId: 2 });
  });

  it("can't be accepted before the active player has rolled", () => {
    let s = tradeState();
    s = act(s, 0, { type: 'offerTrade', to: [1], give: counts({ timber: 1 }), get: counts({ grain: 1 }) }).state;
    s.phase = { kind: 'raider', returnTo: 'main' };
    expect(rejectCode(s, 1, { type: 'respondTrade', offerId: 1, accept: true })).toBe('wrong_phase');
  });
});
