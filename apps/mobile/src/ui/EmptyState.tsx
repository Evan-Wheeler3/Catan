import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../theme/settings';
import { space } from '../theme/tokens';
import { Text } from './primitives';

/** A little island-in-a-bottle illustration for empty and error states. */
function Bottle({ tone }: { tone: 'calm' | 'storm' }) {
  const theme = useTheme();
  const ink = theme.dark ? '#0D0913' : '#2A1F3D';
  return (
    <Svg width={120} height={96} viewBox="0 0 120 96" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M4 78 q14 -8 28 0 t28 0 t28 0 t28 0" stroke={theme.color.secondary} strokeWidth={4} fill="none" strokeLinecap="round" />
      <Path d="M30 70 q-4 -26 20 -34 h22 q24 8 20 34 z" fill={theme.color.surface} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
      <Path d="M72 36 h10 v-10 h-10 z" fill="#C66A3D" stroke={ink} strokeWidth={3} strokeLinejoin="round" />
      <Path d="M40 66 q21 -16 42 0 z" fill={tone === 'calm' ? '#93CF5F' : '#7F889B'} stroke={ink} strokeWidth={2.5} />
      <Path d="M61 56 v-12 m0 0 q-7 -2 -10 3 m10 -3 q7 -2 10 3" stroke={ink} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      {tone === 'storm' ? (
        <Path d="M96 10 l-6 12 h8 l-6 12" stroke={theme.color.danger} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <Circle cx={100} cy={18} r={8} fill={theme.color.primary} stroke={ink} strokeWidth={2.5} />
      )}
    </Svg>
  );
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
