// Tideholm simulator.
//
//   npm run simulate                       Offline: bots play a full game with the engine.
//   npm run simulate -- --online --friend <you>
//                                          Two simulated players join your local backend,
//                                          befriend <you>, accept your game invites and
//                                          play their turns. Invite them from the app.
//   npm run simulate -- --online --selftest
//                                          Three simulated players play a whole game
//                                          through the Edge Functions (end-to-end test).
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY (defaults match `supabase start`).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  applyAction,
  chooseBotAction,
  createGame,
  describeEvent,
  redactState,
  totalVictoryPoints,
  type Action,
  type GameEvent,
  type PlayerView,
} from '../packages/engine/src/index.ts';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
// Point at the Docker-free dev server with FUNCTIONS_URL=http://127.0.0.1:54399/functions/v1
const FUNCTIONS_URL = process.env.FUNCTIONS_URL ?? `${URL}/functions/v1`;

// ---------------------------------------------------------------------------

function offline() {
  const players = Number(opt('players') ?? 3);
  const seed = Number(opt('seed') ?? Date.now() % 100000);
  let s = createGame({ seed, players: ['Marlo', 'Juniper', 'Pip', 'Wren'].slice(0, players).map((n) => ({ userId: n, name: n })) });
  const names = s.players.map((p) => p.name);
  let actions = 0;
  while (s.phase.kind !== 'ended' && actions < 5000) {
    for (const seat of [s.currentSeat, ...s.players.map((p) => p.seat)]) {
      const a = chooseBotAction(redactState(s, seat), seat);
      if (!a) continue;
      const r = applyAction(s, seat, a);
      if (!r.ok) throw new Error(r.error.message);
      s = r.state;
      for (const e of r.events) {
        if (flag('verbose') || e.type === 'gameWon' || e.type === 'awardChanged') console.log(`  ${describeEvent(e, names, null)}`);
      }
      break;
    }
    actions++;
  }
  console.log(`\nSeed ${seed}: ${actions} actions over ${s.turn} turns.`);
  s.players.forEach((p) => console.log(`  ${p.name.padEnd(8)} ${totalVictoryPoints(s, p.seat)} VP`));
}

// ---------------------------------------------------------------------------

interface Sim {
  name: string;
  client: SupabaseClient;
  id: string;
}

async function signIn(name: string): Promise<Sim> {
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const email = `${name}@sim.tideholm.local`;
  const password = 'tideholm-sim-password';
  let { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    const up = await client.auth.signUp({ email, password });
    if (up.error) throw new Error(`Could not create ${name}: ${up.error.message}`);
    ({ data, error } = await client.auth.signInWithPassword({ email, password }));
    if (error) throw error;
  }
  const id = data.user!.id;
  await client.from('profiles').upsert({ id, username: name, avatar: ['otter', 'puffin', 'whale', 'seal'][name.length % 4] });
  return { name, client, id };
}

async function call<T>(sim: Sim, fn: string, body: unknown): Promise<T> {
  const { data: session } = await sim.client.auth.getSession();
  const res = await fetch(`${FUNCTIONS_URL}/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${session.session?.access_token}` },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${sim.name} ${fn}: ${payload?.error?.message ?? res.status}`);
  return payload as T;
}

/** One polling step for a simulated player: answer invites, ready up, take actions. */
async function tick(sim: Sim, log: (m: string) => void): Promise<boolean> {
  // Accept friend requests.
  const { data: incoming } = await sim.client.from('friendships').select('requester').eq('addressee', sim.id).eq('status', 'pending');
  for (const f of incoming ?? []) {
    await sim.client.rpc('respond_friend_request', { from_user: f.requester, accept: true });
    log(`${sim.name} accepted a friend request`);
  }
  // Accept invites and ready up.
  const { data: seats } = await sim.client.from('game_players').select('game_id, status').eq('user_id', sim.id).in('status', ['invited', 'joined']);
  for (const s of seats ?? []) {
    if (s.status === 'invited') await sim.client.rpc('respond_game_invite', { g: s.game_id, accept: true });
    await sim.client.rpc('set_ready', { g: s.game_id, ready: true });
    log(`${sim.name} joined game ${s.game_id.slice(0, 8)} and is ready`);
  }
  // Play wherever we're needed.
  const { data: games } = await sim.client.from('games').select('id, current_user_id, pending_user_ids, status').eq('status', 'active');
  let acted = false;
  for (const g of games ?? []) {
    if (g.current_user_id !== sim.id && !(g.pending_user_ids ?? []).includes(sim.id)) continue;
    const st = await call<{ view: PlayerView }>(sim, 'game-state', { gameId: g.id });
    const action = chooseBotAction(st.view, st.view.viewer!);
    if (!action) continue;
    try {
      await call(sim, 'game-action', { gameId: g.id, action });
      acted = true;
      if (flag('verbose')) log(`${sim.name}: ${action.type}`);
    } catch (e) {
      log(String(e));
    }
  }
  return acted;
}

async function online() {
  if (!ANON) throw new Error('Set SUPABASE_ANON_KEY (see `supabase status`).');
  const log = (m: string) => console.log(`[${new Date().toLocaleTimeString()}] ${m}`);

  if (flag('selftest')) {
    const sims = await Promise.all(['sim_ember', 'sim_tide', 'sim_orchid'].map(signIn));
    const [host, ...others] = sims;
    for (const o of others) {
      await host.client.rpc('send_friend_request', { target_username: o.name });
      await o.client.rpc('respond_friend_request', { from_user: host.id, accept: true });
    }
    const { data: gameId, error } = await host.client.rpc('create_game', { invitees: others.map((o) => o.id), timer_hours: null, game_name: 'Selftest' });
    if (error) throw error;
    for (const o of others) {
      await o.client.rpc('respond_game_invite', { g: gameId, accept: true });
      await o.client.rpc('set_ready', { g: gameId, ready: true });
    }
    await call(host, 'game-start', { gameId });
    log(`Started game ${gameId}`);
    const started = Date.now();
    for (let round = 0; round < 3000; round++) {
      const { data: g } = await host.client.from('games').select('status, seq, summary').eq('id', gameId).single();
      if (g!.status === 'finished') {
        const winner = g!.summary.players.find((p: { seat: number }) => p.seat === g!.summary.winner);
        log(`Finished after ${g!.seq} actions in ${Math.round((Date.now() - started) / 1000)}s — ${winner?.name} won.`);
        // Hidden-information check: a non-winner's view never includes other hands.
        const st = await call<{ view: PlayerView; events: { event: GameEvent }[] }>(others[0], 'game-state', { gameId, since: 0 });
        const leaked = st.view.players.filter((p) => p.seat !== st.view.viewer && p.hand !== null);
        const leakedSteals = st.events.filter(
          (e) => e.event.type === 'stole' && e.event.resource && e.event.thief !== st.view.viewer && e.event.victim !== st.view.viewer,
        );
        if (leaked.length || leakedSteals.length || JSON.stringify(st.view).includes('fortuneDeck')) throw new Error('Hidden information leaked!');
        log('Redaction check passed: no opponent hands, deck, or third-party steals visible.');
        return;
      }
      let any = false;
      for (const s of sims) any = (await tick(s, log)) || any;
      if (!any) await sleep(150);
    }
    throw new Error('Selftest did not finish');
  }

  const friend = opt('friend');
  const sims = await Promise.all(['sim_tide', 'sim_ember'].map(signIn));
  if (friend) {
    for (const s of sims) {
      const { data } = await s.client.rpc('send_friend_request', { target_username: friend });
      log(`${s.name} → friend request to ${friend}: ${data}`);
    }
  }
  log(`Simulated players ${sims.map((s) => s.name).join(' & ')} are online. Invite them to a game from the app. Ctrl+C to stop.`);
  for (;;) {
    let any = false;
    for (const s of sims) any = (await tick(s, log)) || any;
    await sleep(any ? 600 : 2000);
  }
}

(flag('online') ? online() : Promise.resolve(offline())).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

export type { Action };
