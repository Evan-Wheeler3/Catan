import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFriends } from '../src/data/social';
import { supabase } from '../src/data/supabase';
import { Avatar } from '../src/ui/Avatar';
import { EmptyState } from '../src/ui/EmptyState';
import { Field } from '../src/ui/Field';
import { Icon } from '../src/ui/icons';
import { Banner, Button, Screen, Text } from '../src/ui/primitives';
import { useTheme } from '../src/theme/settings';
import { radius, space } from '../src/theme/tokens';

const TIMERS: { value: number | null; label: string }[] = [
  { value: null, label: 'Off' },
  { value: 24, label: '24h' },
  { value: 48, label: '48h' },
  { value: 72, label: '72h' },
];

export default function NewGame() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { friends, loading } = useFriends();
  const accepted = friends.filter((f) => f.status === 'accepted');
  const [picked, setPicked] = useState<string[]>([]);
  const [timer, setTimer] = useState<number | null>(48);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]));

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxxl, gap: space.lg }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <Icon name="back" />
          </Pressable>
          <Text variant="heading" accessibilityRole="header">
            New island
          </Text>
        </View>
        {error && <Banner text={error} onDismiss={() => setError(null)} />}
        <Field label="Name (optional)" value={name} onChangeText={setName} placeholder="Sunday harbor" maxLength={40} />

        <View style={{ gap: space.sm }}>
          <Text variant="title">Invite 2–3 friends</Text>
          <Text variant="caption" color={theme.color.inkSoft}>
            {picked.length}/3 picked · Tideholm plays best with 3 or 4.
          </Text>
          {!loading && accepted.length === 0 && (
            <EmptyState title="Your crew is empty" body="Add friends first — by username or with your invite link — then come back to launch an island." action={<Button small label="Go to Friends" onPress={() => router.replace('/(tabs)/friends')} />} />
          )}
          {accepted.map((f) => {
            const on = picked.includes(f.id);
            return (
              <Pressable
                key={f.id}
                onPress={() => toggle(f.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: !on && picked.length >= 3 }}
                accessibilityLabel={f.username}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  padding: space.md,
                  borderRadius: radius.card,
                  borderWidth: on ? 3 : 2,
                  borderColor: on ? theme.color.secondary : theme.color.outline,
                  backgroundColor: on ? theme.color.surfaceAlt : theme.color.surface,
                  opacity: !on && picked.length >= 3 ? 0.5 : 1,
                }}
              >
                <Avatar id={f.avatar} size={40} />
                <Text variant="label" style={{ flex: 1 }}>
                  {f.username}
                </Text>
                {on && <Icon name="check" size={22} />}
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: space.sm }}>
          <Text variant="title">Turn timer</Text>
          <Text variant="caption" color={theme.color.inkSoft}>
            If someone runs out of time, their turn is played safely for them and skipped.
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {TIMERS.map((t) => (
              <Button key={t.label} small tone={timer === t.value ? 'secondary' : 'plain'} label={t.label} onPress={() => setTimer(t.value)} style={{ flex: 1 }} />
            ))}
          </View>
        </View>

        <Button
          label="Create lobby"
          loading={busy}
          disabled={picked.length < 2}
          onPress={async () => {
            if (!supabase) return;
            setBusy(true);
            const { data, error: e } = await supabase.rpc('create_game', { invitees: picked, timer_hours: timer, game_name: name });
            setBusy(false);
            if (e || !data) setError(e?.message.includes('friends') ? 'You can only invite accepted friends.' : 'Could not create the game. Please try again.');
            else router.replace(`/lobby/${data}`);
          }}
        />
      </ScrollView>
    </Screen>
  );
}
