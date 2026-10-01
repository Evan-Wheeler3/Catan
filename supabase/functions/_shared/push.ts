// Push notifications via the Expo push service.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { formatCounts, RESOURCE_LABEL, type GameEvent, type GameState } from './engine/index.ts';

export interface Notice {
  userId: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

/** Decide who gets told what. Never notifies the person who made the move. */
export function notificationsFor(
  game: { id: string; name: string },
  prev: GameState | null,
  next: GameState,
  events: GameEvent[],
  actorUserId: string | null,
): Notice[] {
  const out: Notice[] = [];
  const name = (seat: number) => next.players[seat].name;
  const user = (seat: number) => next.players[seat].userId;
  const data = { gameId: game.id };
  const add = (seat: number, title: string, body: string, kind: string) => {
    if (user(seat) !== actorUserId) out.push({ userId: user(seat), title, body, data: { ...data, kind } });
  };

  for (const e of events) {
    switch (e.type) {
      case 'stole':
        add(e.victim, 'You were raided!', `${name(e.thief)} took ${e.resource ? `a ${RESOURCE_LABEL[e.resource]}` : 'a card'} in ${game.name}.`, 'raided');
        break;
      case 'discardRequired':
        for (const [seat, n] of Object.entries(e.pending)) add(Number(seat), 'The Raider struck', `Discard ${n} cards in ${game.name}.`, 'discard');
        break;
      case 'tradeOffered':
        for (const to of e.offer.to) {
          add(to, `${name(e.offer.from)} wants to trade`, `${formatCounts(e.offer.give)} for your ${formatCounts(e.offer.get)}`, 'trade');
        }
        break;
      case 'tradeResolved':
        if (e.outcome === 'accepted' && e.by !== null) add(e.from, 'Trade accepted', `${name(e.by)} took your offer in ${game.name}.`, 'trade');
        break;
      case 'gameWon':
        for (const p of next.players) {
          if (p.seat === e.seat) add(p.seat, 'You won! 🏝️', `${e.vp} points in ${game.name}. Nicely built.`, 'won');
          else add(p.seat, `${name(e.seat)} won ${game.name}`, `Final score ${e.vp} points. Rematch?`, 'won');
        }
        break;
    }
  }

  // "Your turn" — on regular turn starts and on each setup hand-over.
  const ended = next.phase.kind === 'ended';
  const newTurn = events.some((e) => e.type === 'turnStarted');
  const setupHandover = next.phase.kind === 'setup' && (!prev || prev.currentSeat !== next.currentSeat);
  if (!ended && (newTurn || setupHandover)) {
    const body = next.phase.kind === 'setup' ? `Place your starting outpost in ${game.name}.` : `Roll the dice in ${game.name}.`;
    add(next.currentSeat, 'Your turn', body, 'turn');
  }
  return out;
}

export async function sendPush(admin: SupabaseClient, notices: Notice[]): Promise<void> {
  if (notices.length === 0) return;
  const userIds = [...new Set(notices.map((n) => n.userId))];
  const { data: tokens } = await admin.from('push_tokens').select('user_id, token').in('user_id', userIds);
  if (!tokens?.length) return;
  const messages = notices.flatMap((n) =>
    tokens
      .filter((t) => t.user_id === n.userId)
      .map((t) => ({ to: t.token, title: n.title, body: n.body, data: n.data, sound: 'default', channelId: 'turns' })),
  );
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const token = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (token) headers.Authorization = `Bearer ${token}`;
  for (let i = 0; i < messages.length; i += 100) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
    if (!res.ok) console.error('expo push error', res.status, await res.text());
  }
}
