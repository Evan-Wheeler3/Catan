import { router } from 'expo-router';
import { EmptyState } from '../src/ui/EmptyState';
import { Button, Screen } from '../src/ui/primitives';

export default function NotFound() {
  return (
    <Screen style={{ justifyContent: 'center' }}>
      <EmptyState tone="storm" title="Off the edge of the map" body="That page doesn't exist. Let's get you back to the harbor." action={<Button label="Home" onPress={() => router.replace('/')} />} />
    </Screen>
  );
}
