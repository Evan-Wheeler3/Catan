// Hidden information, timers, replay and full-game fuzzing.
import { describe, expect, it } from 'vitest';
import {
  applyAction,
  chooseBotAction,
  counts,
  createGame,
  describeEvent,
  PIECES,
  redactEvent,
  redactState,
  replay,
  totalCards,
  type GameState,
  type LoggedAction,
} from '../src/index.ts';
import { act, bankPlusHands, give, mainPhase, newGame, rigDice } from './helpers.ts';

describe('redaction', () => {
  it("never reveals other players' hands, fortune cards, the deck or the RNG", () => {
    const s = mainPhase(3);
    give(s, 1, { stone: 2 });
    s.players[1].fortune.push({ id: 7, kind: 'relic', boughtOnTurn: 0 });
    const view = redactState(s, 0);
    expect(view.players[1].hand).toBeNull();
    expect(view.players[1].fortune).toBeNull();
    expect(view.players[1].handCount).toBe(2);
    expect(view.players[1].fortuneCount).toBe(1);
    expect(view.players[1].totalVP).toBeNull();
    expect(view.players[0].hand).not.toBeNull();
    const json = JSON.stringify(view);
    expect(json).not.toContain('relic');
    expect(json).not.toContain('fortuneDeck');
    expect(json).not.toContain('"rng"');
    expect(view.deckCount).toBe(25);
  });

  it('reveals hidden points once the game has ended', () => {
    const s = mainPhase(3);
    s.players[1].fortune.push({ id: 7, kind: 'relic', boughtOnTurn: 0 });
    s.phase = { kind: 'ended', winner: 0 };
    expect(redactState(s, 0).players[1].totalVP).toBe(1);
  });

  it('hides stolen resources and drawn cards from third parties', () => {
    const stole = { type: 'stole', thief: 0, victim: 1, resource: 'clay' } as const;
    expect(redactEvent(stole, 0)).toEqual(stole);
    expect(redactEvent(stole, 1)).toEqual(stole);
    expect(redactEvent(stole, 2)).toMatchObject({ resource: null });
    const bought = { type: 'fortuneBought', seat: 0, kind: 'relic', cardId: 3 } as const;
    expect(redactEvent(bought, 1)).toMatchObject({ kind: null, cardId: null });
    expect(describeEvent(redactEvent(bought, 1), ['A', 'B'], 1)).toBe('A bought a Fortune card');
    expect(describeEvent(stole, ['A', 'B', 'C'], 1)).toBe('A stole 1 Clay from you');
  });
});

describe('turn timer', () => {
  it('auto-places during setup and passes to the next placement only', () => {
    let s = newGame(4);
    for (let i = 0; i < 3; i++) s = act(s, 'system', { type: 'timeout' }).state;
    expect(s.currentSeat).toBe(3);
    s = act(s, 'system', { type: 'timeout' }).state;
    // Seat 3 places twice in a row in the snake; one timeout covers one placement.
    expect(s.currentSeat).toBe(3);
    expect(s.buildings.filter((b) => b?.owner === 3)).toHaveLength(1);
  });

  it('rolls, resolves and ends an idle turn', () => {
    let s = mainPhase(3);
    s.phase = { kind: 'roll' };
    s = rigDice(s, 9);
    const { state, events } = act(s, 'system', { type: 'timeout' });
    expect(state.currentSeat).toBe(1);
    expect(state.phase.kind).toBe('roll');
    expect(events[0]).toEqual({ type: 'turnSkipped', seat: 0, reason: 'timeout' });
  });

  it('auto-discards for everyone still pending and moves the Raider', () => {
    let s = mainPhase(3);
    give(s, 1, { stone: 10 });
    s.phase = { kind: 'discard', pending: { 1: 5 } };
    const { state, events } = act(s, 'system', { type: 'timeout' });
    expect(state.players[1].hand.stone).toBe(5);
    expect(events.find((e) => e.type === 'discarded')).toMatchObject({ seat: 1, auto: true });
    expect(events.some((e) => e.type === 'raiderMoved')).toBe(true);
    expect(state.currentSeat).toBe(1);
  });
});

/** Plays bots until the game ends; returns the action log. */
function botGame(seed: number, players: number, opts: { timeoutEvery?: number; maxActions?: number; check?: (s: GameState) => void } = {}) {
  let s = createGame({ seed, players: Array.from({ length: players }, (_, i) => ({ userId: `u${i}`, name: `Bot${i}` })) });
  const initial = s;
  const log: LoggedAction[] = [];
  for (let i = 0; i < (opts.maxActions ?? 4000) && s.phase.kind !== 'ended'; i++) {
    let actor: number | 'system' | null = null;
    let action = null;
    if (opts.timeoutEvery && i % opts.timeoutEvery === opts.timeoutEvery - 1) {
      actor = 'system';
      action = { type: 'timeout' } as const;
    } else {
      // Whoever has something to do (discards / trade answers can come from anyone).
      for (const seat of [s.currentSeat, ...s.players.map((p) => p.seat)]) {
        action = chooseBotAction(redactState(s, seat), seat);
        if (action) {
          actor = seat;
          break;
        }
      }
    }
    if (!action || actor === null) throw new Error(`Bots stuck in phase ${s.phase.kind}`);
    const res = applyAction(s, actor, action);
    if (!res.ok) throw new Error(`Bot ${actor} made illegal ${JSON.stringify(action)}: ${res.error.message} (phase ${s.phase.kind})`);
    s = res.state;
    log.push({ seq: s.seq, actor, action });
    opts.check?.(s);
  }
  return { initial, final: s, log };
}

function checkInvariants(s: GameState) {
  expect(bankPlusHands(s)).toEqual(counts({ timber: 19, clay: 19, fleece: 19, grain: 19, stone: 19 }));
  for (const p of s.players) {
    for (const n of Object.values(p.hand)) expect(n).toBeGreaterThanOrEqual(0);
    const outposts = s.buildings.filter((b) => b?.owner === p.seat && b.kind === 'outpost').length;
    const towns = s.buildings.filter((b) => b?.owner === p.seat && b.kind === 'town').length;
    const trails = s.trails.filter((t) => t === p.seat).length;
    expect(outposts + p.outpostsLeft).toBe(PIECES.outposts);
    expect(towns + p.townsLeft).toBe(PIECES.towns);
    expect(trails + p.trailsLeft).toBe(PIECES.trails);
  }
  const fortuneHeld = s.players.reduce((n, p) => n + p.fortune.length, 0);
  expect(fortuneHeld + s.fortuneDeck.length).toBeLessThanOrEqual(25);
}

describe('full games (bots)', () => {
  it('play to completion while preserving invariants', () => {
    let finished = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const players = 3 + (seed % 2);
      const { final } = botGame(seed, players, { timeoutEvery: seed % 3 === 0 ? 41 : undefined, check: checkInvariants });
      if (final.phase.kind === 'ended') {
        finished++;
        const winner = final.phase.winner;
        expect(totalCards(final.players[winner].hand)).toBeGreaterThanOrEqual(0);
      }
    }
    expect(finished).toBeGreaterThanOrEqual(22);
  });

  it('replays an action log to the identical state, from scratch or from a snapshot', () => {
    const { initial, final, log } = botGame(1234, 4);
    expect(replay(initial, log)).toEqual(final);
    const mid = replay(initial, log.slice(0, 100));
    expect(mid.seq).toBe(100);
    expect(replay(mid, log)).toEqual(final);
  });

  it('is deterministic: same seed and actions, same game', () => {
    const a = botGame(77, 3, { maxActions: 300 });
    const b = botGame(77, 3, { maxActions: 300 });
    expect(a.final).toEqual(b.final);
  });

  it('rejects a gap in the action log', () => {
    const { initial, log } = botGame(5, 3, { maxActions: 10 });
    expect(() => replay(initial, [log[0], log[2]])).toThrow(/gap/);
  });
});
