// POST { gameId, action } — the only way a move enters a game.
// Identity comes from the JWT; the engine validates the move against authoritative state.
import { applyAction, type Action } from '../_shared/engine/index.ts';
import { adminClient, requireUser } from '../_shared/clients.ts';
import { corsHeaders, fail, json, readJson } from '../_shared/http.ts';
import { commitAction, ConflictError, loadGame, seatOf } from '../_shared/store.ts';

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const user = await requireUser(req);
  if (!user) return fail(401, 'signed_out', 'Please sign in again.');
  const body = await readJson<{ gameId?: string; action?: Action }>(req);
  if (!body?.gameId || !body.action || typeof body.action !== 'object') {
    return fail(400, 'bad_request', 'That move was not understood.');
  }
  if ((body.action as { type?: string }).type === 'timeout') return fail(403, 'forbidden', 'Only the server can skip turns.');

  const admin = adminClient();
  for (let attempt = 0; attempt < 3; attempt++) {
    const loaded = await loadGame(admin, body.gameId);
    if (!loaded) return fail(404, 'no_game', "We couldn't find that game.");
    if (!loaded.state) return fail(409, 'not_started', "This game hasn't started yet.");
    const seat = seatOf(loaded.state, user.id);
    if (seat === null) return fail(403, 'not_in_game', "You're not playing in this game.");

    const result = applyAction(loaded.state, seat, body.action);
    if (!result.ok) return fail(422, result.error.code, result.error.message);
    try {
      await commitAction(admin, loaded.game, loaded.state, result.state, result.events, seat, user.id, body.action);
      return json({ ok: true, seq: result.state.seq });
    } catch (err) {
      if (err instanceof ConflictError) continue; // someone else moved; re-validate on fresh state
      console.error(err);
      return fail(500, 'server_error', 'Something went wrong saving your move. Please try again.');
    }
  }
  return fail(409, 'busy', 'The table is busy — try that again in a moment.');
}
