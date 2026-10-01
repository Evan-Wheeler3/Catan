-- Tideholm schema.
-- Clients read through RLS and write only through RPCs / Edge Functions.
-- game_actions and game_snapshots hold hidden information and have NO client policies.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles & friends

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  avatar text not null default 'gull',
  created_at timestamptz not null default now()
);
create unique index profiles_username_lower on public.profiles (lower(username));

-- Kept apart from profiles so other users can never read someone's invite code.
create table public.invite_codes (
  user_id uuid primary key references public.profiles on delete cascade,
  code text not null unique default encode(gen_random_bytes(5), 'hex')
);

create table public.friendships (
  requester uuid not null references public.profiles on delete cascade,
  addressee uuid not null references public.profiles on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
create index friendships_addressee on public.friendships (addressee);

create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester = a and addressee = b) or (requester = b and addressee = a))
  );
$$;

create or replace function public.on_profile_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into invite_codes (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger profile_invite_code after insert on public.profiles
  for each row execute function public.on_profile_created();

-- ---------------------------------------------------------------------------
-- Games

create table public.games (
  id uuid primary key default gen_random_uuid(),
  host uuid not null references public.profiles,
  name text not null default 'Island game',
  status text not null default 'lobby' check (status in ('lobby', 'active', 'finished', 'abandoned')),
  turn_timer_hours int check (turn_timer_hours in (24, 48, 72)),
  seq int not null default 0,
  current_user_id uuid references public.profiles,
  -- Everyone who has something to do right now (current player, discards, trade answers).
  pending_user_ids uuid[] not null default '{}',
  turn_deadline timestamptz,
  winner uuid references public.profiles,
  -- Public, non-secret summary for list screens: phase, scores, colors.
  summary jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index games_deadline on public.games (turn_deadline) where status = 'active';

create table public.game_players (
  game_id uuid not null references public.games on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  seat int,
  status text not null default 'invited' check (status in ('invited', 'joined', 'ready', 'declined')),
  last_seen_seq int not null default 0,
  joined_at timestamptz not null default now(),
  primary key (game_id, user_id)
);
create index game_players_user on public.game_players (user_id);

-- Append-only action log (server only).
create table public.game_actions (
  game_id uuid not null references public.games on delete cascade,
  seq int not null,
  actor_user uuid references public.profiles,
  actor_seat int,
  action jsonb not null,
  created_at timestamptz not null default now(),
  primary key (game_id, seq)
);

-- Periodic full-state snapshots (server only — contains hidden hands and RNG).
create table public.game_snapshots (
  game_id uuid not null references public.games on delete cascade,
  seq int not null,
  state jsonb not null,
  created_at timestamptz not null default now(),
  primary key (game_id, seq)
);

-- Redacted events, fanned out per viewer when they contain private details.
create table public.game_events (
  id bigserial primary key,
  game_id uuid not null references public.games on delete cascade,
  seq int not null,
  idx int not null,
  visible_to uuid references public.profiles,
  event jsonb not null,
  created_at timestamptz not null default now()
);
create index game_events_game_seq on public.game_events (game_id, seq);

create table public.push_tokens (
  user_id uuid not null references public.profiles on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

create or replace function public.is_game_member(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from game_players
    where game_id = g and user_id = auth.uid() and status <> 'declined'
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security

alter table public.profiles enable row level security;
alter table public.invite_codes enable row level security;
alter table public.friendships enable row level security;
alter table public.games enable row level security;
alter table public.game_players enable row level security;
alter table public.game_actions enable row level security;
alter table public.game_snapshots enable row level security;
alter table public.game_events enable row level security;
alter table public.push_tokens enable row level security;

create policy "profiles are public to signed-in users" on public.profiles
  for select to authenticated using (true);
create policy "create own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "read own invite code" on public.invite_codes
  for select to authenticated using (user_id = auth.uid());

create policy "read own friendships" on public.friendships
  for select to authenticated using (auth.uid() in (requester, addressee));

create policy "members read games" on public.games
  for select to authenticated using (public.is_game_member(id) or host = auth.uid());

create policy "members read seats" on public.game_players
  for select to authenticated using (public.is_game_member(game_id) or user_id = auth.uid());

create policy "members read their events" on public.game_events
  for select to authenticated
  using (public.is_game_member(game_id) and (visible_to is null or visible_to = auth.uid()));

create policy "own push tokens" on public.push_tokens
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- game_actions / game_snapshots: intentionally no policies (service role only).

-- ---------------------------------------------------------------------------
-- RPCs (security definer, each validates auth.uid())

create or replace function public.send_friend_request(target_username text) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  them uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  select id into them from profiles where lower(username) = lower(target_username);
  if them is null then return 'not_found'; end if;
  if them = me then return 'self'; end if;
  if exists (select 1 from friendships where requester = them and addressee = me) then
    -- They already asked us: accept.
    update friendships set status = 'accepted' where requester = them and addressee = me;
    return 'accepted';
  end if;
  insert into friendships (requester, addressee) values (me, them) on conflict do nothing;
  return case when (select status from friendships where requester = me and addressee = them) = 'accepted'
    then 'already_friends' else 'requested' end;
end $$;

create or replace function public.accept_invite_code(invite text) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  them uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  select user_id into them from invite_codes where code = lower(invite);
  if them is null then return 'not_found'; end if;
  if them = me then return 'self'; end if;
  delete from friendships where (requester = them and addressee = me) or (requester = me and addressee = them);
  insert into friendships (requester, addressee, status) values (them, me, 'accepted');
  return 'accepted';
end $$;

create or replace function public.respond_friend_request(from_user uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if accept then
    update friendships set status = 'accepted' where requester = from_user and addressee = auth.uid();
  else
    delete from friendships where requester = from_user and addressee = auth.uid() and status = 'pending';
  end if;
end $$;

create or replace function public.remove_friend(other uuid) returns void
language sql security definer set search_path = public as $$
  delete from friendships
  where (requester = auth.uid() and addressee = other) or (requester = other and addressee = auth.uid());
$$;

create or replace function public.create_game(invitees uuid[], timer_hours int, game_name text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  g uuid;
  f uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if coalesce(array_length(invitees, 1), 0) not between 1 and 3 then
    raise exception 'Invite one to three friends';
  end if;
  if timer_hours is not null and timer_hours not in (24, 48, 72) then
    raise exception 'Invalid turn timer';
  end if;
  foreach f in array invitees loop
    if f = me or not are_friends(me, f) then raise exception 'You can only invite friends'; end if;
  end loop;
  insert into games (host, turn_timer_hours, name)
    values (me, timer_hours, coalesce(nullif(trim(game_name), ''), 'Island game'))
    returning id into g;
  insert into game_players (game_id, user_id, status) values (g, me, 'joined');
  insert into game_players (game_id, user_id, status)
    select g, unnest(array(select distinct x from unnest(invitees) x)), 'invited';
  return g;
end $$;

create or replace function public.respond_game_invite(g uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update game_players gp set status = case when accept then 'joined' else 'declined' end
  from games
  where gp.game_id = g and gp.user_id = auth.uid() and games.id = g and games.status = 'lobby';
end $$;

create or replace function public.set_ready(g uuid, ready boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update game_players gp set status = case when ready then 'ready' else 'joined' end
  from games
  where gp.game_id = g and gp.user_id = auth.uid() and gp.status in ('joined', 'ready')
    and games.id = g and games.status = 'lobby';
end $$;

create or replace function public.leave_lobby(g uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from games where id = g and host = auth.uid() and status = 'lobby') then
    update games set status = 'abandoned', updated_at = now() where id = g;
  else
    update game_players set status = 'declined' where game_id = g and user_id = auth.uid()
      and exists (select 1 from games where id = g and status = 'lobby');
  end if;
end $$;

create or replace function public.mark_seen(g uuid, upto int) returns void
language sql security definer set search_path = public as $$
  update game_players set last_seen_seq = greatest(last_seen_seq, upto)
  where game_id = g and user_id = auth.uid();
$$;

-- Atomic commit of one validated action, called only by Edge Functions (service role).
-- The (game_id, seq) primary key makes concurrent writers fail with unique_violation,
-- which the function treats as "state moved on, reload and retry".
create or replace function public.commit_game_action(
  g uuid,
  new_seq int,
  actor_user uuid,
  actor_seat int,
  action jsonb,
  events jsonb,          -- [{ idx, visible_to, event }]
  snapshot jsonb,        -- full state or null
  patch jsonb            -- games columns to update
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into game_actions (game_id, seq, actor_user, actor_seat, action)
    values (g, new_seq, actor_user, actor_seat, action);
  insert into game_events (game_id, seq, idx, visible_to, event)
    select g, new_seq, (e->>'idx')::int, nullif(e->>'visible_to', '')::uuid, e->'event'
    from jsonb_array_elements(events) e;
  if snapshot is not null then
    insert into game_snapshots (game_id, seq, state) values (g, new_seq, snapshot);
  end if;
  update games set
    seq = new_seq,
    status = coalesce(patch->>'status', status),
    current_user_id = nullif(patch->>'current_user_id', '')::uuid,
    pending_user_ids = coalesce(array(select jsonb_array_elements_text(patch->'pending_user_ids'))::uuid[], '{}'),
    turn_deadline = case when patch ? 'turn_deadline' then nullif(patch->>'turn_deadline', '')::timestamptz else turn_deadline end,
    winner = coalesce(nullif(patch->>'winner', '')::uuid, winner),
    summary = coalesce(patch->'summary', summary),
    updated_at = now()
  where id = g;
end $$;
revoke execute on function public.commit_game_action from public, anon, authenticated;

-- Remember that the actor saw everything up to their own action.
create or replace function public.bump_seen_for(g uuid, u uuid, upto int) returns void
language sql security definer set search_path = public as $$
  update game_players set last_seen_seq = greatest(last_seen_seq, upto) where game_id = g and user_id = u;
$$;
revoke execute on function public.bump_seen_for from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime

alter publication supabase_realtime add table public.game_events;
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.game_players;
alter publication supabase_realtime add table public.friendships;
