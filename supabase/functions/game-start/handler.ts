// POST { gameId } — host starts a lobby once everyone is ready.
import { createGame } from '../_shared/engine/index.ts';
import { adminClient, requireUser } from '../_shared/clients.ts';
import { corsHeaders, fail, json, readJson } from '../_shared/http.ts';
import { gamePatch } from '../_shared/store.ts';
import { notificationsFor, sendPush } from '../_shared/push.ts';

const MIN_PLAYERS = Number(Deno.env.get('MIN_PLAYERS') ?? '3');

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const user = await requireUser(req);
  if (!user) return fail(401, 'signed_out', 'Please sign in again.');
  const body = await readJson<{ gameId?: string }>(req);
  if (!body?.gameId) return fail(400, 'bad_request', 'Missing game.');

  const admin = adminClient();
  const { data: game } = await admin.from('games').select('*').eq('id', body.gameId).maybeSingle();
  if (!game) return fail(404, 'no_game', "We couldn't find that game.");
  if (game.host !== user.id) return fail(403, 'not_host', 'Only the host can start the game.');
  if (game.status !== 'lobby') return fail(409, 'already_started', 'This game has already started.');

  const { data: seats } = await admin.from('game_players').select('user_id, status').eq('game_id', game.id);
  const playing = (seats ?? []).filter((s) => s.status !== 'declined');
  const waiting = playing.filter((s) => s.user_id !== game.host && s.status !== 'ready');
  if (waiting.length) return fail(409, 'not_ready', 'Everyone needs to tap Ready before the boats can launch.');
  if (playing.length < MIN_PLAYERS || playing.length > 4) {
    return fail(409, 'player_count', `Tideholm needs ${MIN_PLAYERS}–4 players. Invite another friend to fill the island.`);
  }
  const { data: profiles } = await admin.from('profiles').select('id, username').in('id', playing.map((s) => s.user_id));
  const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.username]));

  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const state = createGame({ seed, players: playing.map((s) => ({ userId: s.user_id, name: nameOf.get(s.user_id) ?? 'Player' })) });

  // Claim the lobby atomically so a double tap can't start two games.
  const { data: claimed } = await admin
    .from('games')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', game.id)
    .eq('status', 'lobby')
    .select('id');
  if (!claimed?.length) return fail(409, 'already_started', 'This game has already started.');

  await admin.from('game_snapshots').insert({ game_id: game.id, seq: 0, state });
  for (const p of state.players) {
    await admin.from('game_players').update({ seat: p.seat, status: 'ready' }).eq('game_id', game.id).eq('user_id', p.userId);
  }
  const patch = gamePatch(null, state, game.turn_timer_hours);
  await admin
    .from('games')
    .update({
      current_user_id: patch.current_user_id,
      pending_user_ids: patch.pending_user_ids,
      summary: patch.summary,
      turn_deadline: patch.turn_deadline ?? null,
    })
    .eq('id', game.id);
  await sendPush(admin, notificationsFor(game, null, state, [], user.id)).catch(console.error);
  return json({ ok: true });
}
