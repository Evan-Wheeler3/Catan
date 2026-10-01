import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/data/auth';
import { callFunction, supabase } from '../../src/data/supabase';
import { Avatar } from '../../src/ui/Avatar';
import { EmptyState } from '../../src/ui/EmptyState';
import { Icon } from '../../src/ui/icons';
import { Banner, Button, Card, Chip, Loading, Screen, Text } from '../../src/ui/primitives';
import { useTheme } from '../../src/theme/settings';
import { space } from '../../src/theme/tokens';

interface Member {
  user_id: string;
  status: 'invited' | 'joined' | 'ready' | 'declined';
  username: string;
  avatar: string;
}

export default function Lobby() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const me = session?.user.id;
  const [game, setGame] = useState<{ name: string; host: string; status: string; turn_timer_hours: number | null } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !id) return;
    const { data: g } = await supabase.from('games').select('name, host, status, turn_timer_hours').eq('id', id).maybeSingle();
    if (!g) {
      setMissing(true);
      return;
    }
    if (g.status === 'active' || g.status === 'finished') {
      router.replace(`/game/${id}`);
      return;
    }
    setGame(g);
    const { data: seats } = await supabase.from('game_players').select('user_id, status').eq('game_id', id);
    const { data: profiles } = await supabase.from('profiles').select('id, username, avatar').in('id', (seats ?? []).map((s) => s.user_id));
    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    setMembers((seats ?? []).map((s) => ({ ...s, username: byId.get(s.user_id)?.username ?? '…', avatar: byId.get(s.user_id)?.avatar ?? 'gull' })) as Member[]);
  }, [id]);

  useEffect(() => {
    load();
    if (!supabase || !id) return;
    const ch = supabase
      .channel(`lobby:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${id}` }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${id}` }, load)
      .subscribe();
    return () => {
      supabase?.removeChannel(ch);
    };
  }, [id, load]);

  if (missing || game?.status === 'abandoned') {
    return (
      <Screen style={{ paddingTop: insets.top, justifyContent: 'center' }}>
        <EmptyState tone="storm" title="This lobby has drifted away" body="The host closed it, or the link is out of date." action={<Button label="Back to games" onPress={() => router.replace('/(tabs)')} />} />
      </Screen>
    );
  }
  if (!game) return <Loading label="Gathering the crew…" />;

  const isHost = game.host === me;
  const mine = members.find((m) => m.user_id === me);
  const active = members.filter((m) => m.status !== 'declined');
  const allReady = active.every((m) => m.user_id === game.host || m.status === 'ready');
  const canStart = isHost && allReady && active.length >= 3;
  const statusLabel: Record<Member['status'], string> = { invited: 'Invited', joined: 'Joined', ready: 'Ready', declined: 'Declined' };

  const rpc = async (fn: string, args: Record<string, unknown>) => {
    setBusy(true);
    const { error: e } = await supabase!.rpc(fn, args);
    setBusy(false);
    if (e) setError('That did not go through. Please try again.');
    load();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxxl, gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <Icon name="back" />
          </Pressable>
          <Text variant="heading" style={{ flex: 1 }} accessibilityRole="header">
            {game.name}
          </Text>
        </View>
        <Text color={theme.color.inkSoft}>
          {game.turn_timer_hours ? `${game.turn_timer_hours}-hour turn timer.` : 'No turn timer — take your time.'} Seats and the island are dealt randomly when the game starts.
        </Text>
        {error && <Banner text={error} onDismiss={() => setError(null)} />}
        {members.map((m) => (
          <Card key={m.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, opacity: m.status === 'declined' ? 0.5 : 1 }}>
            <Avatar id={m.avatar} size={44} />
            <Text variant="label" style={{ flex: 1 }}>
              {m.user_id === me ? 'You' : m.username}
              {m.user_id === game.host ? ' · host' : ''}
            </Text>
            <Chip
              label={m.user_id === game.host && m.status !== 'declined' ? 'Host' : statusLabel[m.status]}
              color={m.status === 'ready' ? theme.color.success : undefined}
              ink={m.status === 'ready' ? '#FFFFFF' : undefined}
              style={{ alignSelf: 'center' }}
            />
          </Card>
        ))}

        {mine?.status === 'invited' && (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button tone="plain" label="Decline" onPress={() => rpc('respond_game_invite', { g: id, accept: false }).then(() => router.back())} style={{ flex: 1 }} />
            <Button label="Join" loading={busy} onPress={() => rpc('respond_game_invite', { g: id, accept: true })} style={{ flex: 1 }} />
          </View>
        )}
        {!isHost && (mine?.status === 'joined' || mine?.status === 'ready') && (
          <Button
            tone={mine.status === 'ready' ? 'plain' : 'secondary'}
            label={mine.status === 'ready' ? "I'm not ready" : "I'm ready"}
            loading={busy}
            onPress={() => rpc('set_ready', { g: id, ready: mine.status !== 'ready' })}
          />
        )}
        {isHost && (
          <>
            <Button
              label="Launch the boats"
              loading={busy}
              disabled={!canStart}
              onPress={async () => {
                setBusy(true);
                const res = await callFunction('game-start', { gameId: id });
                setBusy(false);
                if (res.error) setError(res.error.message);
                else router.replace(`/game/${id}`);
              }}
            />
            {!canStart && (
              <Text variant="caption" color={theme.color.inkSoft} style={{ textAlign: 'center' }}>
                {active.length < 3 ? 'You need at least 3 players. Invite another friend from a new game.' : 'Waiting for everyone to tap Ready.'}
              </Text>
            )}
          </>
        )}
        <Button tone="plain" small label={isHost ? 'Cancel this game' : 'Leave lobby'} onPress={() => rpc('leave_lobby', { g: id }).then(() => router.replace('/(tabs)'))} />
      </ScrollView>
    </Screen>
  );
}
