import { View, useWindowDimensions, Pressable } from 'react-native';
import { useState } from 'react';
import { useFeedback } from '../lib/feedback';
import { Icon, type IconName } from '../ui/icons';
import { Text } from '../ui/primitives';
import { useTheme } from '../theme/settings';
import { space } from '../theme/tokens';
import { PixelBox } from '../ui/PixelBox';

export interface BarAction {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
  badge?: number;
  hint?: string;
}

function BarButton({ a, compact }: { a: BarAction; compact: boolean }) {
  const theme = useTheme();
  const { tap } = useFeedback();
  const [pressed, setPressed] = useState(false);
  const face = a.primary ? theme.color.primary : theme.color.surface;
  const lipColor = a.primary ? theme.color.primaryLip : theme.color.cardLip;
  return (
    <Pressable
      style={{ flex: a.primary ? 1.35 : 1, opacity: a.disabled ? 0.4 : 1 }}
      disabled={a.disabled}
      onPress={a.onPress}
      onPressIn={() => {
        setPressed(true);
        tap();
      }}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={a.label}
      accessibilityHint={a.hint}
      accessibilityState={{ disabled: !!a.disabled }}
    >
      <PixelBox
        face={face}
        border={theme.color.outline}
        lip={lipColor}
        lipHeight={pressed ? 1 : 5}
        shine={a.primary ? 'rgba(255,255,255,0.4)' : undefined}
        style={{ marginTop: pressed ? 4 : 0 }}
        contentStyle={{ minHeight: 56, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }}
      >
        <Icon name={a.icon} size={compact ? 28 : 24} ink={a.primary ? theme.color.onPrimary : undefined} fill={a.primary ? '#FFFFFF' : undefined} />
        {!compact && (
          <Text variant="label" color={a.primary ? theme.color.onPrimary : theme.color.ink} style={{ fontSize: 13, lineHeight: 16 }} numberOfLines={1}>
            {a.label}
          </Text>
        )}
      </PixelBox>
      {!!a.badge && (
        <View style={{ position: 'absolute', top: -6, right: -2, minWidth: 22, height: 22, backgroundColor: theme.color.danger, borderWidth: 3, borderColor: theme.color.outline, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="number" color={theme.color.onDanger} style={{ fontSize: 12, lineHeight: 14 }}>
            {a.badge}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** Thumb-reachable bottom bar. Labels collapse to icons at large text sizes. */
export function ActionBar({ actions }: { actions: BarAction[] }) {
  const { fontScale } = useWindowDimensions();
  const compact = fontScale > 1.3;
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.md }}>
      {actions.map((a) => (
        <BarButton key={a.key} a={a} compact={compact} />
      ))}
    </View>
  );
}
