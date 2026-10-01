import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/data/auth';
import { AvatarPicker } from '../src/ui/Avatar';
import { Field } from '../src/ui/Field';
import { Button, Screen, Text } from '../src/ui/primitives';
import { useTheme } from '../src/theme/settings';
import { space } from '../src/theme/tokens';

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { saveProfile, profile } = useAuth();
  const [username, setUsername] = useState(profile?.username ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar ?? 'gull');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.xl, gap: space.xl }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: space.sm }}>
          <Text variant="heading" accessibilityRole="header">
            Welcome ashore
          </Text>
          <Text color={theme.color.inkSoft}>Pick a name friends can find you by, and a face for the table.</Text>
        </View>
        <Field
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          placeholder="e.g. harbor_hana"
          hint="3–20 letters, numbers or underscores."
          error={error}
        />
        <AvatarPicker value={avatar} onChange={setAvatar} />
        <Button
          label="Set sail"
          loading={busy}
          disabled={username.trim().length < 3}
          onPress={async () => {
            setBusy(true);
            const err = await saveProfile(username, avatar);
            setBusy(false);
            if (err) setError(err);
            else router.replace('/(tabs)');
          }}
        />
      </ScrollView>
    </Screen>
  );
}
