import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/data/auth';
import { AvatarPicker } from '../../src/ui/Avatar';
import { Banner, Button, Card, Screen, SectionHeader, Text } from '../../src/ui/primitives';
import { useSettings, type Settings } from '../../src/theme/settings';
import { radius, space } from '../../src/theme/tokens';

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  const { theme } = useSettings();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{label}</Text>
      <View style={{ flexDirection: 'row', borderWidth: 2, borderColor: theme.color.outline, borderRadius: radius.chip, overflow: 'hidden' }} accessibilityRole="radiogroup">
        {options.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === o.value }}
            style={{ flex: 1, paddingVertical: space.sm, alignItems: 'center', backgroundColor: value === o.value ? theme.color.primary : theme.color.surface }}
          >
            <Text variant="label" color={value === o.value ? theme.color.onPrimary : theme.color.ink}>
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const { theme } = useSettings();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ flex: 1 }}>
        <Text variant="label">{label}</Text>
        {hint && (
          <Text variant="caption" color={theme.color.inkSoft}>
            {hint}
          </Text>
        )}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: theme.color.secondary, false: theme.color.surfaceAlt }} accessibilityLabel={label} />
    </View>
  );
}

export default function Profile() {
  const insets = useSafeAreaInsets();
  const { settings, update, theme } = useSettings();
  const { profile, online, saveProfile, signOut } = useAuth();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.md }}>
        <Text variant="heading" accessibilityRole="header">
          {profile?.username ?? 'You'}
        </Text>
        {message && <Banner tone="info" text={message} onDismiss={() => setMessage(null)} />}
        {profile && (
          <Card style={{ gap: space.md }}>
            <Text variant="title">Your face at the table</Text>
            <AvatarPicker
              value={profile.avatar}
              onChange={async (a) => {
                const err = await saveProfile(profile.username, a);
                setMessage(err ?? 'Avatar updated.');
              }}
            />
            <Button small tone="plain" label="Change username" onPress={() => router.push('/onboarding')} />
          </Card>
        )}

        <SectionHeader title="Look & feel" />
        <Card style={{ gap: space.lg }}>
          <Segmented<Settings['theme']>
            label="Theme"
            value={settings.theme}
            onChange={(v) => update({ theme: v })}
            options={[
              { value: 'system', label: 'Auto' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
          <Segmented<Settings['reduceMotion']>
            label="Reduce motion"
            value={settings.reduceMotion}
            onChange={(v) => update({ reduceMotion: v })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'on', label: 'On' },
              { value: 'off', label: 'Off' },
            ]}
          />
          <Toggle label="Haptics" value={settings.haptics} onChange={(v) => update({ haptics: v })} hint="Little taps when you place pieces and press buttons." />
          <Toggle label="Sound effects" value={settings.sound} onChange={(v) => update({ sound: v })} hint="Dice clacks, card flicks and a victory tune." />
        </Card>

        {online && profile && (
          <>
            <SectionHeader title="Account" />
            <Button tone="danger" label="Sign out" onPress={signOut} />
          </>
        )}
        <Text variant="caption" color={theme.color.inkFaint} style={{ textAlign: 'center', marginTop: space.xl }}>
          Tideholm 0.1 · Player colors are color-blind safe and every seat also has its own crest and pattern.
        </Text>
      </ScrollView>
    </Screen>
  );
}
