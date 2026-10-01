# Tideholm — Technical Plan

## Repo layout

```
packages/engine     Pure, deterministic TS rules engine (no deps). Shared by app + server.
supabase/           Postgres migrations, RLS, Edge Functions (Deno) — the authority.
apps/mobile         Expo (React Native) app, Expo Router.
scripts/            simulate.ts (bots / two simulated players), sync-engine.mjs
docs/               This plan + DESIGN.md
```

## Authority model

1. Client sends `{ gameId, action, expectedSeq }` to the `game-action` Edge Function.
2. Server loads latest snapshot + later actions, replays with the engine, resolves the
   caller's seat from the JWT (never from the payload), and calls
   `applyAction(state, seat, action)`.
3. On success it inserts the action at `seq = n+1` (unique `(game_id, seq)` gives
   optimistic concurrency), inserts per-viewer redacted events, updates the game row,
   writes a snapshot every 20 actions, and sends push notifications.
4. Clients receive events through Supabase Realtime (`game_events`, RLS-filtered so each
   user only ever receives public events or their own private ones), then fetch a fresh
   redacted view from `game-state`.

Hidden information (hands, Fortune cards, deck order, RNG state) lives only in
`game_snapshots.state` / `game_actions`, which have **no** client-readable RLS policy.

## Data model (Postgres)

| Table | Key columns |
| --- | --- |
| `profiles` | `id (auth.users)`, `username unique`, `avatar`, `invite_code unique` |
| `friendships` | `requester`, `addressee`, `status ('pending'|'accepted')` |
| `games` | `id`, `host`, `status ('lobby'|'active'|'finished'|'abandoned')`, `turn_timer_hours (null|24|48|72)`, `seq`, `current_user_id`, `turn_deadline`, `winner`, `public_summary jsonb` |
| `game_players` | `game_id`, `user_id`, `seat`, `status ('invited'|'joined'|'ready'|'declined')`, `last_seen_seq` |
| `game_actions` | `game_id`, `seq`, `actor_seat`, `action jsonb`, `created_at` — append-only, server-only |
| `game_snapshots` | `game_id`, `seq`, `state jsonb` — server-only |
| `game_events` | `game_id`, `seq`, `idx`, `visible_to (null = everyone)`, `event jsonb` |
| `push_tokens` | `user_id`, `token`, `platform` |

## Action schema (client → server)

```ts
type Action =
  | { type: 'placeSetupOutpost'; vertex: number }
  | { type: 'placeSetupTrail'; edge: number }
  | { type: 'roll' }
  | { type: 'discard'; cards: ResourceCounts }
  | { type: 'moveRaider'; hex: number; victim?: Seat }
  | { type: 'buildTrail'; edge: number }
  | { type: 'buildOutpost'; vertex: number }
  | { type: 'buildTown'; vertex: number }
  | { type: 'buyFortune' }
  | { type: 'playWarden' } | { type: 'playTrailblazer' }
  | { type: 'playWindfall'; resources: [Resource, Resource] }
  | { type: 'playEmbargo'; resource: Resource }
  | { type: 'harborTrade'; give: Resource; get: Resource }       // 4:1, 3:1 or 2:1, best rate auto
  | { type: 'offerTrade'; to: Seat[]; give: ResourceCounts; get: ResourceCounts }
  | { type: 'respondTrade'; offerId: number; accept: boolean }
  | { type: 'cancelTrade'; offerId: number }
  | { type: 'endTurn' }
  | { type: 'timeout' }                                           // server/system only
```

## Event schema (server → clients)

Every action yields an ordered list of `GameEvent`s. Each event is redacted per viewer
(`redactEvent(event, seat)`) before storage — e.g. `stole` hides the resource from
everyone but thief and victim, `fortuneBought` hides the card kind from others.

`diceRolled · produced · discarded · raiderMoved · stole · built · fortuneBought ·
fortunePlayed · windfallTaken · embargoCollected · harborTraded · tradeOffered ·
tradeResolved · turnStarted · turnSkipped · awardChanged · gameWon`

The "since you were last here" replay = events with `seq > game_players.last_seen_seq`.

## Screen map

```
Sign in (Apple / Google / email)
 └─ Onboarding: username + avatar picker
Home (tabs)
 ├─ Games: Your turn ▸ Waiting ▸ Invitations ▸ Finished      [+ New game]
 │   ├─ New game: pick 2–3 friends, turn timer → Lobby (ready states, start)
 │   └─ Game board
 │        ├─ "Since you were here" replay sheet
 │        ├─ Bottom action bar: Roll · Build · Trade · Fortune · End
 │        ├─ Hand fan, player rail (VP, cards, awards)
 │        └─ Sheets: build, trade (players/harbor), offers inbox, discard, fortune, log
 ├─ Friends: list, pending requests, add by username, share invite link
 └─ Profile: avatar, username, theme, sound, haptics, reduced motion, sign out
Practice (offline vs bots — same engine, no backend required)
```

## Key decisions

- **Trading in async**: rules require the active player in every trade. Offers persist
  until answered, withdrawn, or the active player's turn ends. Non-active players may send
  counter-offers to the active player.
- **Discards on a 7** are collected in parallel from every affected player; the turn
  resumes when the last one lands (or the timer auto-discards randomly).
- **Turn timer** fires a `timeout` system action that resolves whatever is pending
  (random valid setup placement, random discard, random raider move, or end turn).
- **Longest Trail tie rule**: the current holder keeps it on a tie; if the holder is
  broken below the max and several players tie, nobody holds it.
- **Bank shortage**: if the bank can't pay every claim on a resource, nobody gets it,
  unless only one player is owed, who gets whatever remains.
