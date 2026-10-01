// Scheduled (pg_cron, every 5 min): applies `timeout` to games whose turn timer expired.
import { applyAction } from '../_shared/engine/index.ts';
import { adminClient, isServiceCall } from '../_shared/clients.ts';
import { fail, json } from '../_shared/http.ts';
import { commitAction, ConflictError, loadGame } from '../_shared/store.ts';

export async function handler(req: Request): Promise<Response> {
  if (!isServiceCall(req)) return fail(401, 'forbidden', 'Not allowed.');
  const admin = adminClient();
  const { data: due } = await admin
    .from('games')
    .select('id')
    .eq('status', 'active')
    .not('turn_deadline', 'is', null)
    .lt('turn_deadline', new Date().toISOString())
    .limit(50);

  const results: Record<string, string> = {};
  for (const { id } of due ?? []) {
    try {
      const loaded = await loadGame(admin, id);
      if (!loaded?.state) continue;
      const res = applyAction(loaded.state, 'system', { type: 'timeout' });
      if (!res.ok) {
        results[id] = res.error.code;
        continue;
      }
      await commitAction(admin, loaded.game, loaded.state, res.state, res.events, 'system', null, { type: 'timeout' });
      results[id] = 'skipped';
    } catch (err) {
      results[id] = err instanceof ConflictError ? 'raced' : 'error';
      if (!(err instanceof ConflictError)) console.error(id, err);
    }
  }
  return json({ processed: results });
}
