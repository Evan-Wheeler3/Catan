import {
  applyAction,
  counts,
  createGame,
  topology,
  type Action,
  type Actor,
  type GameEvent,
  type GameState,
  type ResourceCounts,
  type Seat,
} from '../src/index.ts';

export function newGame(players = 4, seed = 42): GameState {
  return createGame({
    seed,
    shuffleSeats: false,
    players: Array.from({ length: players }, (_, i) => ({ userId: `u${i}`, name: `P${i}` })),
  });
}

/** Applies an action and asserts it succeeded. */
export function act(state: GameState, actor: Actor, action: Action): { state: GameState; events: GameEvent[] } {
  const res = applyAction(state, actor, action);
  if (!res.ok) throw new Error(`Expected ${action.type} to succeed: ${res.error.code} ${res.error.message}`);
  return { state: res.state, events: res.events };
}

export function rejectCode(state: GameState, actor: Actor, action: Action): string {
  const res = applyAction(state, actor, action);
  if (res.ok) throw new Error(`Expected ${action.type} to fail`);
  return res.error.code;
}

/** A blank board in the main phase of turn 1 (setup skipped), seat 0 to act. */
export function mainPhase(players = 4, seed = 42): GameState {
  const s = newGame(players, seed);
  s.phase = { kind: 'main' };
  s.turn = 1;
  s.currentSeat = 0;
  s.dice = [3, 4];
  return s;
}

export function give(s: GameState, seat: Seat, c: Partial<ResourceCounts>): void {
  const full = counts(c);
  for (const r of Object.keys(full) as (keyof ResourceCounts)[]) {
    s.players[seat].hand[r] += full[r];
    s.bank[r] -= full[r];
  }
}

export function placeOutpost(s: GameState, seat: Seat, vertex: number, kind: 'outpost' | 'town' = 'outpost') {
  s.buildings[vertex] = { owner: seat, kind };
  if (kind === 'outpost') s.players[seat].outpostsLeft--;
  else s.players[seat].townsLeft--;
}

export function placeTrail(s: GameState, seat: Seat, edge: number) {
  s.trails[edge] = seat;
  s.players[seat].trailsLeft--;
}

export function edgeBetween(a: number, b: number): number {
  const e = topology().edges.find((x) => x.vertices.includes(a) && x.vertices.includes(b));
  if (!e) throw new Error(`no edge ${a}-${b}`);
  return e.id;
}

/** A simple path of `length` edges starting at `start` (vertices never repeat). */
export function simplePath(start: number, length: number, avoid: Set<number> = new Set()): { vertices: number[]; edges: number[] } {
  const topo = topology();
  const search = (path: number[]): number[] | null => {
    if (path.length === length + 1) return path;
    const last = path[path.length - 1];
    for (const n of topo.vertices[last].neighbors) {
      if (path.includes(n) || avoid.has(n)) continue;
      const res = search([...path, n]);
      if (res) return res;
    }
    return null;
  };
  const vertices = search([start]);
  if (!vertices) throw new Error('no path');
  const edges = vertices.slice(1).map((v, i) => edgeBetween(vertices[i], v));
  return { vertices, edges };
}

/** Finds an RNG state that makes the next roll total `total`. */
export function rigDice(s: GameState, total: number): GameState {
  for (let k = 1; k < 100000; k++) {
    const t = { ...s, rng: k, phase: { kind: 'roll' as const } };
    const res = applyAction(t, t.currentSeat, { type: 'roll' });
    if (res.ok && res.state.dice![0] + res.state.dice![1] === total) return { ...s, rng: k };
  }
  throw new Error('could not rig dice');
}

export function hexWithToken(s: GameState, token: number, exclude: number[] = []): number {
  const id = s.board.hexes.findIndex((h, i) => h.token === token && !exclude.includes(i));
  if (id < 0) throw new Error(`no hex with ${token}`);
  return id;
}

export function bankPlusHands(s: GameState): ResourceCounts {
  const total = { ...s.bank };
  for (const p of s.players) for (const r of Object.keys(total) as (keyof ResourceCounts)[]) total[r] += p.hand[r];
  return total;
}
