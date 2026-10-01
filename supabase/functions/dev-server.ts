// Runs every Edge Function in one local Deno process, without Docker:
//   deno run -A --env-file=.env.functions supabase/functions/dev-server.ts
// Serves http://127.0.0.1:54399/functions/v1/<name>. Production uses `supabase functions deploy`.
import { handler as gameAction } from './game-action/handler.ts';
import { handler as gameStart } from './game-start/handler.ts';
import { handler as gameState } from './game-state/handler.ts';
import { handler as gameTick } from './game-tick/handler.ts';

const routes: Record<string, (req: Request) => Promise<Response>> = {
  'game-action': gameAction,
  'game-start': gameStart,
  'game-state': gameState,
  'game-tick': gameTick,
};

const port = Number(Deno.env.get('FUNCTIONS_PORT') ?? '54399');
Deno.serve({ port, hostname: '0.0.0.0' }, async (req) => {
  const name = new URL(req.url).pathname.replace(/^\/functions\/v1\//, '').replace(/\/$/, '');
  const route = routes[name];
  if (!route) return new Response('Not found', { status: 404 });
  const started = performance.now();
  const res = await route(req);
  console.log(`${req.method} ${name} → ${res.status} (${Math.round(performance.now() - started)}ms)`);
  return res;
});
