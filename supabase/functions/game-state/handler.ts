// POST { gameId, since? } — the caller's redacted view plus events they haven't seen.
import { redactState } from '../_shared/engine/index.ts';
import { adminClient, requireUser } from '../_shared/clients.ts';
import { corsHeaders, fail, json, readJson } from '../_shared/http.ts';
import { loadGame, seatOf } from '../_shared/store.ts';

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const user = await requireUser(req);
  if (!user) return fail(401, 'signed_out', 'Please sign in again.');
  const body = await readJson<{ gameId?: string; since?: number }>(req);
  if (!body?.gameId) return fail(400, 'bad_request', 'Missing game.');

  const admin = adminClient();
  const loaded = await loadGame(admin, body.gameId);
  if (!loaded) return fail(404, 'no_game', "We couldn't find that game.");
  const me = loaded.seats.find((s) => s.user_id === user.id && s.status !== 'declined');
  if (!me) return fail(403, 'not_in_game', "You're not playing in this game.");

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, username, avatar')
    .in('id', loaded.seats.map((s) => s.user_id));

  if (!loaded.state) {
    return json({ game: loaded.game, seats: loaded.seats, profiles, view: null, events: [], lastSeenSeq: 0 });
  }
  const seat = seatOf(loaded.state, user.id);
  const since = Number.isInteger(body.since) ? body.since! : me.last_seen_seq;
  const { data: events } = await admin
    .from('game_events')
    .select('seq, idx, event')
    .eq('game_id', body.gameId)
    .gt('seq', since)
    .or(`visible_to.is.null,visible_to.eq.${user.id}`)
    .order('seq')
    .order('idx')
    .limit(500);

  return json({
    game: loaded.game,
    seats: loaded.seats,
    profiles,
    view: redactState(loaded.state, seat),
    events: events ?? [],
    lastSeenSeq: me.last_seen_seq,
  });
}
