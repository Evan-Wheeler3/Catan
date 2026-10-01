// Loading and committing authoritative game state.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  type Action,
  type Actor,
  type GameEvent,
  type GameState,
  type LoggedAction,
  isPrivateEvent,
  publicVictoryPoints,
  redactEvent,
  replay,
} from './engine/index.ts';
import { notificationsFor, sendPush } from './push.ts';

export const SNAPSHOT_EVERY = 20;

export interface GameRow {
  id: string;
  host: string;
  name: string;
  status: 'lobby' | 'active' | 'finished' | 'abandoned';
  turn_timer_hours: number | null;
  seq: number;
  turn_deadline: string | null;
}

export interface SeatRow {
  user_id: string;
  seat: number | null;
  status: string;
  last_seen_seq: number;
}

export interface LoadedGame {
  game: GameRow;
  seats: SeatRow[];
  state: GameState | null;
}

export async function loadGame(admin: SupabaseClient, gameId: string): Promise<LoadedGame | null> {
  const { data: game } = await admin.from('games').select('*').eq('id', gameId).maybeSingle();
  if (!game) return null;
  const { data: seats } = await admin.from('game_players').select('user_id, seat, status, last_seen_seq').eq('game_id', gameId);
  if (game.status === 'lobby' || game.status === 'abandoned') return { game, seats: seats ?? [], state: null };

  const { data: snap } = await admin
    .from('game_snapshots')
    .select('seq, state')
    .eq('game_id', gameId)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!snap) throw new Error(`Game ${gameId} has no snapshot`);
  const { data: actions, error } = await admin
    .from('game_actions')
    .select('seq, actor_seat, action')
    .eq('game_id', gameId)
    .gt('seq', snap.seq)
    .order('seq');
  if (error) throw error;
  const log: LoggedAction[] = (actions ?? []).map((a) => ({
    seq: a.seq,
    actor: (a.actor_seat ?? 'system') as Actor,
    action: a.action as Action,
  }));
  return { game, seats: seats ?? [], state: replay(snap.state as GameState, log) };
}

export function seatOf(state: GameState, userId: string): number | null {
  const p = state.players.find((x) => x.userId === userId);
  return p ? p.seat : null;
}

/** Users who have something to do: the current player, pending discards, trade recipients. */
export function pendingUsers(state: GameState): string[] {
  if (state.phase.kind === 'ended') return [];
  const seats = new Set<number>();
  if (state.phase.kind === 'discard') {
    for (const k of Object.keys(state.phase.pending)) seats.add(Number(k));
  } else {
    seats.add(state.currentSeat);
  }
  for (const o of state.offers) for (const t of o.to) if (!o.declined.includes(t)) seats.add(t);
  return [...seats].map((s) => state.players[s].userId);
}

export function publicSummary(state: GameState) {
  return {
    phase: state.phase.kind,
    turn: state.turn,
    currentSeat: state.currentSeat,
    winner: state.phase.kind === 'ended' ? state.phase.winner : null,
    players: state.players.map((p) => ({
      seat: p.seat,
      userId: p.userId,
      name: p.name,
      vp: publicVictoryPoints(state, p.seat),
    })),
  };
}

function turnMarker(s: GameState): string {
  return s.phase.kind === 'setup' ? `setup:${s.phase.index}` : `turn:${s.turn}`;
}

export function gamePatch(prev: GameState | null, next: GameState, timerHours: number | null) {
  const ended = next.phase.kind === 'ended';
  const patch: Record<string, unknown> = {
    status: ended ? 'finished' : 'active',
    current_user_id: ended ? '' : next.players[next.currentSeat].userId,
    pending_user_ids: pendingUsers(next),
    summary: publicSummary(next),
  };
  if (ended) {
    patch.winner = next.players[(next.phase as { winner: number }).winner].userId;
    patch.turn_deadline = '';
  } else if (timerHours) {
    const newTurn = !prev || turnMarker(prev) !== turnMarker(next);
    const newDiscard = next.phase.kind === 'discard' && prev?.phase.kind !== 'discard';
    if (newTurn || newDiscard) patch.turn_deadline = new Date(Date.now() + timerHours * 3600_000).toISOString();
  }
  return patch;
}

/** Expands events into rows: one public row, or one redacted row per player for private events. */
export function eventRows(state: GameState, events: GameEvent[]) {
  const rows: { idx: number; visible_to: string | null; event: GameEvent }[] = [];
  events.forEach((event, idx) => {
    if (!isPrivateEvent(event)) {
      rows.push({ idx, visible_to: null, event });
      return;
    }
    for (const p of state.players) rows.push({ idx, visible_to: p.userId, event: redactEvent(event, p.seat) });
  });
  return rows;
}

export class ConflictError extends Error {}

export async function commitAction(
  admin: SupabaseClient,
  game: GameRow,
  prev: GameState,
  next: GameState,
  events: GameEvent[],
  actor: Actor,
  actorUserId: string | null,
  action: Action,
): Promise<void> {
  const { error } = await admin.rpc('commit_game_action', {
    g: game.id,
    new_seq: next.seq,
    actor_user: actorUserId,
    actor_seat: actor === 'system' ? null : actor,
    action,
    events: eventRows(next, events),
    snapshot: next.seq % SNAPSHOT_EVERY === 0 || next.phase.kind === 'ended' ? next : null,
    patch: gamePatch(prev, next, game.turn_timer_hours),
  });
  if (error) {
    if (error.code === '23505') throw new ConflictError('Someone else moved first');
    throw error;
  }
  if (actorUserId) await admin.rpc('bump_seen_for', { g: game.id, u: actorUserId, upto: next.seq });

  // Notifications are best-effort and never fail the move.
  try {
    await sendPush(admin, notificationsFor(game, prev, next, events, actorUserId));
  } catch (err) {
    console.error('push failed', err);
  }
}
