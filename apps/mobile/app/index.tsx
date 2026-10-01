import { Redirect } from 'expo-router';
import { useAuth } from '../src/data/auth';
import { Loading } from '../src/ui/primitives';

export default function Gate() {
  const { ready, online, session, profile } = useAuth();
  if (!ready) return <Loading label="Charting the island…" />;
  if (online && !session) return <Redirect href="/sign-in" />;
  if (online && !profile) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
