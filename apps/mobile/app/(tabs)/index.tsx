import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/data/auth';
import { hasPracticeGame } from '../../src/data/connection';
import { useGames, type GameListItem } from '../../src/data/social';
import { Avatar } from '../../src/ui/Avatar';
import { EmptyState } from '../../src/ui/EmptyState';
import { Icon } from '../../src/ui/icons';
import { Button, Card, Chip, Screen, SectionHeader, Text } from '../../src/ui/primitives';
import { useTheme } from '../../src/theme/settings';
import { seatStyles, space } from '../../src/theme/tokens';

function ago(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

function GameCard({ g, me }: { g: GameListItem; me: string }) {
  const theme = useTheme();
  const players = g.summary.players ?? [];
  const current = players.find((p) => p.seat === g.summary.currentSeat);
  const winner = players.find((p) => p.seat === g.summary.winner);
  const line =
    g.status === 'lobby'
      ? g.myStatus === 'invited'
        ? 'You are invited'
        : `${g.members.filter((m) => m.status === 'ready' || m.userId === g.host).length}/${g.members.length} ready`
      : g.status === 'finished'
        ? `${winner?.userId === me ? 'You' : winner?.name ?? 'Someone'} won`
        : g.yourMove
          ? g.summary.currentSeat !== undefined && current?.userId !== me
            ? 'Something needs your answer'
            : g.summary.phase === 'setup'
              ? 'Place your starting pieces'
              : 'Your turn — roll the dice'
          : `Waiting for ${current?.name ?? '…'}`;
  const href = g.status === 'lobby' ? `/lobby/${g.id}` : `/game/${g.id}`;
  return (
    <Card onPress={() => router.push(href as never)} accessibilityLabel={`${g.name}. ${line}`} style={{ gap: space.sm, backgroundColor: g.yourMove ? theme.color.primary : theme.color.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text variant="title" style={{ flex: 1 }} color={g.yourMove ? theme.color.onPrimary : theme.color.ink} numberOfLines={1}>
          {g.name}
        </Text>
        {g.summary.turn ? <Chip label={`Turn ${g.summary.turn}`} /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {g.members.map((m, i) => (
          <View key={m.userId} style={{ marginLeft: i ? -8 : 0 }}>
            <Avatar id={m.avatar} size={34} ring={m.seat !== null ? seatStyles[m.seat].color : undefined} />
          </View>
        ))}
        <Text variant="label" style={{ marginLeft: space.md, flex: 1 }} color={g.yourMove ? theme.color.onPrimary : theme.color.ink}>
          {line}
        </Text>
      </View>
      <Text variant="caption" color={g.yourMove ? theme.color.onPrimary : theme.color.inkSoft}>
        Updated {ago(g.updatedAt)}
        {g.timerHours ? ` · ${g.timerHours}h turns` : ''}
        {players.length ? ` · ${players.map((p) => `${p.userId === me ? 'You' : p.name} ${p.vp}`).join(' · ')}` : ''}
      </Text>
    </Card>
  );
}

export default function Games() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { online, session, profile } = useAuth();
  const { games, loading, error, reload } = useGames();
  const [practice, setPractice] = useState<{ turn: number; ended: boolean } | null>(null);
  useFocusEffect(
    useCallback(() => {
      hasPracticeGame().then((s) => setPractice(s ? { turn: s.state.turn, ended: s.state.phase.kind === 'ended' } : null));
    }, []),
  );
  const me = session?.user.id ?? '';
  const yourTurn = games.filter((g) => g.yourMove);
  const invites = games.filter((g) => g.status === 'lobby' && g.myStatus === 'invited');
  const lobbies = games.filter((g) => g.status === 'lobby' && g.myStatus !== 'invited');
  const waiting = games.filter((g) => g.status === 'active' && !g.yourMove);
  const finished = games.filter((g) => g.status === 'finished').slice(0, 10);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingHorizontal: space.lg, paddingBottom: space.xxxl * 2 }}
        refreshControl={online ? <RefreshControl refreshing={false} onRefresh={reload} tintColor={theme.color.secondary} /> : undefined}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Text variant="heading" accessibilityRole="header">
              {profile ? `Ahoy, ${profile.username}` : 'Tideholm'}
            </Text>
            <Text color={theme.color.inkSoft}>{yourTurn.length ? `${yourTurn.length} island${yourTurn.length > 1 ? 's' : ''} waiting on you` : 'All caught up.'}</Text>
          </View>
          {profile && <Avatar id={profile.avatar} size={48} />}
        </View>

        {online && error && <EmptyState tone="storm" title="Rough seas" body={error} action={<Button small tone="plain" label="Try again" onPress={reload} />} />}

        {yourTurn.length > 0 && <SectionHeader title="Your turn" count={yourTurn.length} />}
        <View style={{ gap: space.md }}>{yourTurn.map((g) => <GameCard key={g.id} g={g} me={me} />)}</View>

        {invites.length > 0 && <SectionHeader title="Invitations" count={invites.length} />}
        <View style={{ gap: space.md }}>{invites.map((g) => <GameCard key={g.id} g={g} me={me} />)}</View>

        {lobbies.length > 0 && <SectionHeader title="Gathering crews" />}
        <View style={{ gap: space.md }}>{lobbies.map((g) => <GameCard key={g.id} g={g} me={me} />)}</View>

        {waiting.length > 0 && <SectionHeader title="Waiting on others" />}
        <View style={{ gap: space.md }}>{waiting.map((g) => <GameCard key={g.id} g={g} me={me} />)}</View>

        {online && !loading && !error && games.length === 0 && (
          <EmptyState
            title="No islands yet"
            body="Start a game with two or three friends. Turns can take minutes or days — we'll nudge you when it's your move."
            action={<Button label="Start a game" icon={<Icon name="plus" size={20} />} onPress={() => router.push('/new-game')} />}
          />
        )}
        {!online && (
          <EmptyState
            title="Online play isn't set up"
            body="This build has no server configured, but you can still play a full practice game against friendly bots."
          />
        )}

        <SectionHeader title="Practice" />
        <Card onPress={() => router.push(practice && !practice.ended ? '/game/practice' : '/practice')} accessibilityLabel="Practice game against bots" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Icon name="boat" size={40} />
          <View style={{ flex: 1 }}>
            <Text variant="title">{practice && !practice.ended ? 'Continue practice' : 'Practice vs bots'}</Text>
            <Text variant="caption" color={theme.color.inkSoft}>
              {practice && !practice.ended ? `Turn ${practice.turn} — your crew is waiting.` : 'Learn the ropes offline. No timer, no pressure.'}
            </Text>
          </View>
        </Card>

        {finished.length > 0 && <SectionHeader title="Finished" />}
        <View style={{ gap: space.md }}>{finished.map((g) => <GameCard key={g.id} g={g} me={me} />)}</View>
      </ScrollView>
      {online && (
        <View style={{ position: 'absolute', right: space.lg, bottom: space.lg }}>
          <Button label="New game" icon={<Icon name="plus" size={20} />} onPress={() => router.push('/new-game')} />
        </View>
      )}
    </Screen>
  );
}
