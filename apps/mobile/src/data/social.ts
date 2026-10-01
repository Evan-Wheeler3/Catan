// Friends + game list hooks (RLS-protected reads, RPC writes, Realtime refresh).
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './auth';
import { supabase } from './supabase';

export interface FriendRow {
  id: string;
  username: string;
  avatar: string;
  status: 'accepted' | 'incoming' | 'outgoing';
}

export function useFriends() {
  const { session } = useAuth();
  const me = session?.user.id;
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !me) return;
    const { data, error: e } = await supabase.from('friendships').select('requester, addressee, status');
    if (e) {
      setError("Couldn't load your crew. Pull to try again.");
      setLoading(false);
      return;
    }
    const others = (data ?? []).map((f) => (f.requester === me ? f.addressee : f.requester));
    const { data: profiles } = others.length
      ? await supabase.from('profiles').select('id, username, avatar').in('id', others)
      : { data: [] as { id: string; username: string; avatar: string }[] };
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    setFriends(
      (data ?? [])
        .map((f) => {
          const other = f.requester === me ? f.addressee : f.requester;
          const p = byId.get(other);
          const status: FriendRow['status'] = f.status === 'accepted' ? 'accepted' : f.requester === me ? 'outgoing' : 'incoming';
          return p ? { id: other, username: p.username, avatar: p.avatar, status } : null;
        })
        .filter((x): x is FriendRow => !!x)
        .sort((a, b) => a.username.localeCompare(b.username)),
    );
    setError(null);
    setLoading(false);
  }, [me]);

  useEffect(() => {
    load();
    if (!supabase || !me) return;
    const ch = supabase
      .channel(`friends:${me}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => load())
      .subscribe();
    return () => {
      supabase?.removeChannel(ch);
    };
  }, [load, me]);

  return { friends, loading, error, reload: load };
}

export async function sendFriendRequest(username: string): Promise<string> {
  if (!supabase) return 'Online play is not set up.';
  const { data, error } = await supabase.rpc('send_friend_request', { target_username: username.trim() });
  if (error) return 'Could not send that request. Please try again.';
  switch (data) {
    case 'not_found':
      return `No islander called “${username.trim()}”. Check the spelling?`;
    case 'self':
      return "That's you! Try a friend's username.";
    case 'accepted':
      return 'They had already asked you — you are now friends!';
    case 'already_friends':
      return "You're already friends.";
    default:
      return 'Request sent! They’ll see it on their Friends tab.';
  }
}

export async function acceptInviteCode(code: string): Promise<string> {
  if (!supabase) return 'Online play is not set up.';
  const { data, error } = await supabase.rpc('accept_invite_code', { invite: code });
  if (error) return 'Could not use that invite. Please try again.';
  if (data === 'not_found') return 'That invite link has expired or is mistyped.';
  if (data === 'self') return "That's your own invite link — share it with a friend!";
  return 'You are now friends!';
}

export async function respondFriend(id: string, accept: boolean) {
  await supabase?.rpc('respond_friend_request', { from_user: id, accept });
}

export async function removeFriend(id: string) {
  await supabase?.rpc('remove_friend', { other: id });
}

export function inviteUrl(code: string): string {
  const host = process.env.EXPO_PUBLIC_INVITE_HOST;
  return host ? `https://${host}/invite/${code}` : Linking.createURL(`invite/${code}`);
}

export async function myInviteCode(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('invite_codes').select('code').maybeSingle();
  return data?.code ?? null;
}

// ---------------------------------------------------------------------------

export interface GameListItem {
  id: string;
  name: string;
  status: 'lobby' | 'active' | 'finished' | 'abandoned';
  host: string;
  myStatus: string;
  yourMove: boolean;
  updatedAt: string;
  deadline: string | null;
  timerHours: number | null;
  summary: {
    phase?: string;
    turn?: number;
    currentSeat?: number;
    winner?: number | null;
    players?: { seat: number; userId: string; name: string; vp: number }[];
  };
  members: { userId: string; username: string; avatar: string; status: string; seat: number | null }[];
}

export function useGames() {
  const { session } = useAuth();
  const me = session?.user.id;
  const [games, setGames] = useState<GameListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !me) return;
    const { data: mine, error: e1 } = await supabase.from('game_players').select('game_id, status').eq('user_id', me).neq('status', 'declined');
    if (e1) {
      setError("Couldn't reach the harbor. Pull down to try again.");
      setLoading(false);
      return;
    }
    const ids = (mine ?? []).map((m) => m.game_id);
    if (!ids.length) {
      setGames([]);
      setLoading(false);
      setError(null);
      return;
    }
    const [{ data: rows }, { data: seats }] = await Promise.all([
      supabase.from('games').select('*').in('id', ids).neq('status', 'abandoned').order('updated_at', { ascending: false }),
      supabase.from('game_players').select('game_id, user_id, status, seat').in('game_id', ids),
    ]);
    const userIds = [...new Set((seats ?? []).map((s) => s.user_id))];
    const { data: profiles } = await supabase.from('profiles').select('id, username, avatar').in('id', userIds);
    const prof = new Map((profiles ?? []).map((p) => [p.id, p]));
    const myStatus = new Map((mine ?? []).map((m) => [m.game_id, m.status]));
    setGames(
      (rows ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        status: g.status,
        host: g.host,
        myStatus: myStatus.get(g.id) ?? 'joined',
        yourMove: g.status === 'active' && (g.current_user_id === me || (g.pending_user_ids ?? []).includes(me)),
        updatedAt: g.updated_at,
        deadline: g.turn_deadline,
        timerHours: g.turn_timer_hours,
        summary: g.summary ?? {},
        members: (seats ?? [])
          .filter((s) => s.game_id === g.id && s.status !== 'declined')
          .map((s) => ({ userId: s.user_id, username: prof.get(s.user_id)?.username ?? '…', avatar: prof.get(s.user_id)?.avatar ?? 'gull', status: s.status, seat: s.seat })),
      })),
    );
    setError(null);
    setLoading(false);
  }, [me]);

  useEffect(() => {
    load();
    if (!supabase || !me) return;
    const ch = supabase
      .channel(`games:${me}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players' }, () => load())
      .subscribe();
    return () => {
      supabase?.removeChannel(ch);
    };
  }, [load, me]);

  return { games, loading, error, reload: load };
}
