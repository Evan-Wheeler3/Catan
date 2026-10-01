// Event-sourcing helpers: a game is its initial state plus an append-only action log.

import { applyAction } from './game.ts';
import type { Action, Actor, GameEvent, GameState } from './types.ts';

export interface LoggedAction {
  /** The state's seq *after* this action was applied (1-based). */
  seq: number;
  actor: Actor;
  action: Action;
}

/**
 * Re-applies logged actions on top of a snapshot. Actions at or below the snapshot's seq
 * are skipped. Throws if the log is inconsistent (it was validated when written).
 */
export function replay(
  snapshot: GameState,
  actions: LoggedAction[],
  onEvents?: (seq: number, events: GameEvent[]) => void,
): GameState {
  let state = snapshot;
  for (const a of [...actions].sort((x, y) => x.seq - y.seq)) {
    if (a.seq <= state.seq) continue;
    if (a.seq !== state.seq + 1) throw new Error(`Action log gap: expected seq ${state.seq + 1}, got ${a.seq}`);
    const res = applyAction(state, a.actor, a.action);
    if (!res.ok) throw new Error(`Replay failed at seq ${a.seq}: ${res.error.message}`);
    state = res.state;
    onEvents?.(a.seq, res.events);
  }
  return state;
}
