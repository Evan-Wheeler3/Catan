import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/data/auth';
import { BOT_NAMES, clearPracticeGame, hasPracticeGame, newPracticeGame } from '../src/data/connection';
import { Avatar } from '../src/ui/Avatar';
import { HeroIsland } from '../src/ui/Hero';
import { Icon } from '../src/ui/icons';
import { Button, Card, Screen, Text } from '../src/ui/primitives';
import { useTheme } from '../src/theme/settings';
import { space } from '../src/theme/tokens';

export default function Practice() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [opponents, setOpponents] = useState(2);
  const [existing, setExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    hasPracticeGame().then((s) => setExisting(!!s && s.state.phase.kind !== 'ended'));
  }, []);

  const start = async () => {
    setBusy(true);
    await newPracticeGame(opponents, profile?.username ?? 'You', profile?.avatar ?? 'gull');
    router.replace('/game/practice');
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxxl, gap: space.lg }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="back" />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <HeroIsland size={180} />
          <Text variant="heading" accessibilityRole="header">
            Practice island
          </Text>
          <Text color={theme.color.inkSoft} style={{ textAlign: 'center' }}>
            Same rules as online play. Bots take their turns right away, and your game is saved on this device.
          </Text>
        </View>
        <Text variant="title">Opponents</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {[2, 3].map((n) => (
            <Button key={n} tone={opponents === n ? 'secondary' : 'plain'} label={`${n} bots`} onPress={() => setOpponents(n)} style={{ flex: 1 }} />
          ))}
        </View>
        <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          {BOT_NAMES.slice(0, opponents).map((n, i) => (
            <View key={n} style={{ alignItems: 'center', gap: 4 }}>
              <Avatar id={['otter', 'puffin', 'whale'][i]} size={44} />
              <Text variant="caption">{n}</Text>
            </View>
          ))}
        </Card>
        {existing && <Button tone="secondary" label="Continue current game" onPress={() => router.replace('/game/practice')} />}
        <Button label={existing ? 'Start over' : 'Start practice'} loading={busy} onPress={async () => {
          if (existing) await clearPracticeGame();
          await start();
        }} />
      </ScrollView>
    </Screen>
  );
}
