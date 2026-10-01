import { describe, expect, it } from 'vitest';
import { createGame, topology, totalCards, validSetupOutposts, validTrails, type GameState } from '../src/index.ts';
import { act, newGame, rejectCode } from './helpers.ts';

function playSetup(s: GameState): { state: GameState; seats: number[] } {
  const seats: number[] = [];
  while (s.phase.kind === 'setup') {
    const seat = s.currentSeat;
    seats.push(seat);
    const vertex = validSetupOutposts(s)[0];
    s = act(s, seat, { type: 'placeSetupOutpost', vertex }).state;
    const edge = validTrails(s, seat, vertex)[0];
    s = act(s, seat, { type: 'placeSetupTrail', edge }).state;
  }
  return { state: s, seats };
}

describe('setup phase', () => {
  it('runs in snake order for 4 players', () => {
    const { state, seats } = playSetup(newGame(4));
    expect(seats).toEqual([0, 1, 2, 3, 3, 2, 1, 0]);
    expect(state.phase.kind).toBe('roll');
    expect(state.currentSeat).toBe(0);
    expect(state.turn).toBe(1);
  });

  it('runs in snake order for 3 players', () => {
    const { seats } = playSetup(newGame(3));
    expect(seats).toEqual([0, 1, 2, 2, 1, 0]);
  });

  it('only pays resources for the second outpost', () => {
    let s = newGame(3);
    let placements = 0;
    while (s.phase.kind === 'setup') {
      const seat = s.currentSeat;
      const before = totalCards(s.players[seat].hand);
      const vertex = validSetupOutposts(s)[0];
      s = act(s, seat, { type: 'placeSetupOutpost', vertex }).state;
      const gained = totalCards(s.players[seat].hand) - before;
      const producing = topology().vertices[vertex].hexes.filter((h) => s.board.hexes[h].terrain !== 'dunes').length;
      expect(gained).toBe(placements < 3 ? 0 : producing);
      s = act(s, seat, { type: 'placeSetupTrail', edge: validTrails(s, seat, vertex)[0] }).state;
      placements++;
    }
    const total = s.players.reduce((n, p) => n + totalCards(p.hand), 0);
    expect(total + totalCards(s.bank)).toBe(95);
  });

  it('enforces the distance rule and turn order', () => {
    let s = newGame(4);
    const v = 20;
    s = act(s, 0, { type: 'placeSetupOutpost', vertex: v }).state;
    expect(rejectCode(s, 1, { type: 'placeSetupTrail', edge: topology().vertices[v].edges[0] })).toBe('not_your_turn');
    s = act(s, 0, { type: 'placeSetupTrail', edge: topology().vertices[v].edges[0] }).state;
    const neighbor = topology().vertices[v].neighbors[1];
    expect(rejectCode(s, 1, { type: 'placeSetupOutpost', vertex: neighbor })).toBe('too_close');
    expect(rejectCode(s, 1, { type: 'placeSetupOutpost', vertex: v })).toBe('too_close');
  });

  it('requires the setup trail to touch the outpost just placed', () => {
    let s = newGame(4);
    s = act(s, 0, { type: 'placeSetupOutpost', vertex: 20 }).state;
    const far = topology().edges.find((e) => !e.vertices.includes(20))!;
    expect(rejectCode(s, 0, { type: 'placeSetupTrail', edge: far.id })).toBe('not_connected');
    expect(rejectCode(s, 0, { type: 'placeSetupOutpost', vertex: 40 })).toBe('wrong_phase');
    expect(rejectCode(s, 0, { type: 'roll' })).toBe('wrong_phase');
  });

  it('shuffles seats deterministically by seed', () => {
    const players = ['a', 'b', 'c', 'd'].map((id) => ({ userId: id, name: id }));
    const a = createGame({ seed: 5, players });
    const b = createGame({ seed: 5, players });
    expect(a.players.map((p) => p.userId)).toEqual(b.players.map((p) => p.userId));
    const orders = new Set(Array.from({ length: 20 }, (_, i) => createGame({ seed: i, players }).players.map((p) => p.userId).join()));
    expect(orders.size).toBeGreaterThan(1);
  });

  it('rejects malformed input without throwing', () => {
    const s = newGame(3);
    expect(rejectCode(s, 0, { type: 'placeSetupOutpost', vertex: 999 })).toBe('bad_input');
    expect(rejectCode(s, 0, { type: 'placeSetupOutpost', vertex: 1.5 })).toBe('bad_input');
    expect(rejectCode(s, 0, { type: 'nope' } as never)).toBe('bad_action');
    expect(rejectCode(s, 7, { type: 'roll' })).toBe('not_in_game');
    expect(rejectCode(s, 0, { type: 'timeout' })).toBe('forbidden');
  });
});
