import type { ReactNode } from 'react';
import { View } from 'react-native';
import { PixelIcon } from '../pixel/PixelArt';
import { bottleArt } from '../pixel/scenes';
import { useTheme } from '../theme/settings';
import { space } from '../theme/tokens';
import { Text } from './primitives';

/** A pixel message-in-a-bottle for empty and error states. */
function Bottle({ tone }: { tone: 'calm' | 'storm' }) {
  return <PixelIcon art={bottleArt(tone)} size={132} box={44} />;
}

export function EmptyState({
  title,
  body,
  action,
  tone = 'calm',
}: {
  title: string;
  body: string;
  action?: ReactNode;
  tone?: 'calm' | 'storm';
}) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.xl, gap: space.md }} accessibilityRole="summary">
      <Bottle tone={tone} />
      <Text variant="title" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      <Text color={theme.color.inkSoft} style={{ textAlign: 'center', maxWidth: 320 }}>
        {body}
      </Text>
      {action}
    </View>
  );
}
