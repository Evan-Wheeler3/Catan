// A GameConnection is how the game screen talks to a game, whether it's an online game
// (server-authoritative via Edge Functions + Realtime) or an offline practice game
// (the same engine running on-device, with bots in the other seats).
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  applyAction,
  chooseBotAction,
  createGame,
  redactEvent,
  redactState,
  type Action,
  type GameEvent,
  type GameState,
  type PlayerView,
  type Seat,
} from '@tideholm/engine';
import { callFunction, supabase } from './supabase';

export interface SeqEvent {
  seq: number;
  idx: number;
  event: GameEvent;
}

export interface SeatInfo {
  seat: Seat;
  userId: string;
  name: string;
  avatar: string;
  bot?: boolean;
}

export interface GameSnapshot {
  view: PlayerView;
  mySeat: Seat | null;
  seats: SeatInfo[];
  gameName: string;
  timerHours: number | null;
  deadline: string | null;
  /** Events that arrived since the previous snapshot (drive animations). */
  fresh: SeqEvent[];
}

export type SubmitResult = { ok: true } | { ok: false; code: string; message: string };

export interface GameConnection {
  kind: 'online' | 'practice';
  /** Loads state; resolves with events the player hasn't seen yet (for the replay). */
  open(): Promise<{ snapshot: GameSnapshot; unseen: SeqEvent[] } | { error: string }>;
  subscribe(listener: (s: GameSnapshot) => void): () => void;
  submit(action: Action): Promise<SubmitResult>;
  markSeen(seq: number): void;
  close(): void;
}

// ---------------------------------------------------------------------------
// Online

interface StateResponse {
  game: { id: string; name: string; turn_timer_hours: number | null; turn_deadline: string | null; status: string };
  seats: { user_id: string; seat: number | null; status: string }[];
  profiles: { id: string; username: string; avatar: string }[];
  view: PlayerView | null;
  events: SeqEvent[];
  lastSeenSeq: number;
}

export function onlineConnection(gameId: string): GameConnection {
  const listeners = new Set<(s: GameSnapshot) => void>();
  let lastSeq = 0;
  let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
  let refreshing: Promise<void> | null = null;
  let again = false;

  const toSnapshot = (r: StateResponse, fresh: SeqEvent[]): GameSnapshot => {
    const profile = new Map(r.profiles.map((p) => [p.id, p]));
    const view = r.view!;
    return {
      view,
      mySeat: view.viewer,
      seats: view.players.map((p) => ({ seat: p.seat, userId: p.userId, name: profile.get(p.userId)?.username ?? p.name, avatar: profile.get(p.userId)?.avatar ?? 'gull' })),
      gameName: r.game.name,
      timerHours: r.game.turn_timer_hours,
      deadline: r.game.turn_deadline,
      fresh,
    };
  };

  const refresh = async () => {
    if (refreshing) {
      again = true;
      return refreshing;
    }
    refreshing = (async () => {
      do {
        again = false;
        const res = await callFunction<StateResponse>('game-state', { gameId, since: lastSeq });
        if (res.error || !res.data.view) continue;
        const fresh = res.data.events.filter((e) => e.seq > lastSeq);
        lastSeq = Math.max(lastSeq, res.data.view.seq);
        const snap = toSnapshot(res.data, fresh);
        listeners.forEach((l) => l(snap));
      } while (again);
    })().finally(() => (refreshing = null));
    return refreshing;
  };

  return {
    kind: 'online',
    async open() {
      const res = await callFunction<StateResponse>('game-state', { gameId });
      if (res.error) return { error: res.error.message };
      if (!res.data.view) return { error: "This game hasn't started yet." };
      lastSeq = res.data.view.seq;
      // Realtime: RLS ensures we only ever receive public events or our own private ones.
      channel = supabase!
        .channel(`game:${gameId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_events', filter: `game_id=eq.${gameId}` }, () => {
          refresh();
        })
        .subscribe();
      return { snapshot: toSnapshot(res.data, []), unseen: res.data.events };
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    async submit(action) {
      const res = await callFunction<{ ok: true; seq: number }>('game-action', { gameId, action });
      if (res.error) return { ok: false, ...res.error };
      await refresh();
      return { ok: true };
    },
    markSeen(seq) {
      supabase?.rpc('mark_seen', { g: gameId, upto: seq }).then(() => {}, () => {});
    },
    close() {
      if (channel) supabase?.removeChannel(channel);
      listeners.clear();
    },
  };
}

// ---------------------------------------------------------------------------
// Practice (offline, on-device)

const PRACTICE_KEY = 'tideholm.practice.v1';
export const BOT_NAMES = ['Marlo', 'Juniper', 'Pip'];
const BOT_AVATARS = ['otter', 'puffin', 'whale'];
export const ME = 'me';

interface PracticeSave {
  state: GameState;
  events: SeqEvent[];
  lastSeen: number;
  avatar: string;
  name: string;
}

export async function hasPracticeGame(): Promise<PracticeSave | null> {
  try {
    const raw = await AsyncStorage.getItem(PRACTICE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw) as PracticeSave;
    return save.state?.version === 1 ? save : null;
  } catch {
    return null;
  }
}

export async function newPracticeGame(opponents: number, name: string, avatar: string): Promise<void> {
  const seed = Math.floor(Math.random() * 2 ** 31);
  const players = [{ userId: ME, name }, ...BOT_NAMES.slice(0, opponents).map((n, i) => ({ userId: `bot${i}`, name: n }))];
  const state = createGame({ seed, players });
  const save: PracticeSave = { state, events: [], lastSeen: 0, avatar, name };
  await AsyncStorage.setItem(PRACTICE_KEY, JSON.stringify(save));
}

export async function clearPracticeGame() {
  await AsyncStorage.removeItem(PRACTICE_KEY);
}

export function practiceConnection(botDelayMs = 700): GameConnection {
  const listeners = new Set<(s: GameSnapshot) => void>();
  let save: PracticeSave;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const mySeat = () => save.state.players.find((p) => p.userId === ME)!.seat;
  const persist = () => AsyncStorage.setItem(PRACTICE_KEY, JSON.stringify(save)).catch(() => {});
  const snapshot = (fresh: SeqEvent[]): GameSnapshot => {
    const seat = mySeat();
    return {
      view: redactState(save.state, seat),
      mySeat: seat,
      seats: save.state.players.map((p) => {
        const bot = p.userId !== ME;
        const i = bot ? Number(p.userId.slice(3)) : -1;
        return { seat: p.seat, userId: p.userId, name: bot ? p.name : save.name, avatar: bot ? BOT_AVATARS[i] : save.avatar, bot };
      }),
      gameName: 'Practice island',
      timerHours: null,
      deadline: null,
      fresh: fresh.map((e) => ({ ...e, event: redactEvent(e.event, seat) })),
    };
  };
  const emit = (fresh: SeqEvent[]) => {
    const s = snapshot(fresh);
    listeners.forEach((l) => l(s));
  };

  const apply = (actor: Seat, action: Action): SubmitResult => {
    const res = applyAction(save.state, actor, action);
    if (!res.ok) return { ok: false, ...res.error };
    save.state = res.state;
    const fresh = res.events.map((event, idx) => ({ seq: res.state.seq, idx, event }));
    save.events = [...save.events, ...fresh].slice(-400);
    persist();
    emit(fresh);
    return { ok: true };
  };

  /** One bot step, or false if no bot has anything to do. */
  const botStep = (emitEvents: boolean): boolean => {
    if (save.state.phase.kind === 'ended') return false;
    const me = mySeat();
    const order = [save.state.currentSeat, ...save.state.players.map((p) => p.seat)].filter((s) => s !== me);
    for (const seat of order) {
      const action = chooseBotAction(redactState(save.state, seat), seat);
      if (!action) continue;
      if (emitEvents) {
        const r = apply(seat, action);
        if (!r.ok) console.warn('bot move rejected', r.message);
        return r.ok;
      }
      const res = applyAction(save.state, seat, action);
      if (!res.ok) return false;
      save.state = res.state;
      save.events = [...save.events, ...res.events.map((event, idx) => ({ seq: res.state.seq, idx, event }))].slice(-400);
      return true;
    }
    return false;
  };

  /** Bots act one step at a time so the player can watch what happens. */
  const scheduleBots = () => {
    if (timer || closed) return;
    timer = setTimeout(() => {
      timer = null;
      if (closed) return;
      if (botStep(true)) scheduleBots();
    }, botDelayMs);
  };

  return {
    kind: 'practice',
    async open() {
      const loaded = await hasPracticeGame();
      if (!loaded) return { error: 'No practice game yet. Start one from the home screen.' };
      save = loaded;
      // Like friends playing while you were away: bots catch up instantly, and the
      // replay shows what they did.
      let steps = 0;
      while (steps++ < 300 && botStep(false));
      if (steps > 1) persist();
      const unseen = save.events.filter((e) => e.seq > save.lastSeen).map((e) => ({ ...e, event: redactEvent(e.event, mySeat()) }));
      scheduleBots();
      return { snapshot: snapshot([]), unseen };
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    async submit(action) {
      const r = apply(mySeat(), action);
      if (r.ok) scheduleBots();
      return r;
    },
    markSeen(seq) {
      save.lastSeen = Math.max(save.lastSeen, seq);
      persist();
    },
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
      listeners.clear();
    },
  };
}
