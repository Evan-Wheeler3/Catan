import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/data/auth';
import { acceptInviteCode } from '../../src/data/social';
import { EmptyState } from '../../src/ui/EmptyState';
import { Button, Loading, Screen } from '../../src/ui/primitives';

export default function Invite() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const insets = useSafeAreaInsets();
  const { ready, session, profile } = useAuth();
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (ready && session && profile && code) acceptInviteCode(code).then(setResult);
  }, [ready, session, profile, code]);

  if (!ready) return <Loading />;
  if (!session || !profile) {
    return (
      <Screen style={{ paddingTop: insets.top, justifyContent: 'center' }}>
        <EmptyState title="You've been invited!" body="Sign in or create an account first, then open the invite link again to join your friend's crew." action={<Button label="Sign in" onPress={() => router.replace('/sign-in')} />} />
      </Screen>
    );
  }
  if (!result) return <Loading label="Accepting invite…" />;
  return (
    <Screen style={{ paddingTop: insets.top, justifyContent: 'center' }}>
      <EmptyState title={result.startsWith('You are now') ? 'Welcome aboard!' : 'Hmm'} body={result} action={<Button label="See your friends" onPress={() => router.replace('/(tabs)/friends')} />} />
    </Screen>
  );
}
