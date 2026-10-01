import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Pressable,
  Text as RNText,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useFeedback } from '../lib/feedback';
import { useTheme } from '../theme/settings';
import { lip, radius, space, type } from '../theme/tokens';
import { PixelBox } from './PixelBox';

type Variant = keyof typeof type;

export function Text({
  variant = 'body',
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string; style?: StyleProp<TextStyle> }) {
  const theme = useTheme();
  return <RNText {...rest} style={[type[variant], { color: color ?? theme.color.ink }, style]} />;
}

type Tone = 'primary' | 'secondary' | 'danger' | 'plain';

/**
 * The signature "cardboard lip" button: a solid darker edge under the face that collapses
 * when pressed, with a light haptic.
 */
export function Button({
  label,
  onPress,
  tone = 'primary',
  icon,
  disabled,
  loading,
  small,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress?: () => void;
  tone?: Tone;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  const { tap } = useFeedback();
  const [pressed, setPressed] = useState(false);
  const c = theme.color;
  const tones: Record<Tone, { face: string; ink: string; lip: string }> = {
    primary: { face: c.primary, ink: c.onPrimary, lip: c.primaryLip },
    secondary: { face: c.secondary, ink: c.onSecondary, lip: c.secondaryLip },
    danger: { face: c.danger, ink: c.onDanger, lip: c.dangerLip },
    plain: { face: c.surface, ink: c.ink, lip: c.cardLip },
  };
  const t = tones[tone];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPressIn={() => {
        setPressed(true);
        tap();
      }}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      hitSlop={6}
      style={[{ opacity: inactive ? 0.5 : 1 }, style]}
    >
      <PixelBox
        face={t.face}
        border={c.outline}
        lip={t.lip}
        lipHeight={pressed ? 1 : lip.rest + 1}
        shine={tone === 'plain' ? undefined : 'rgba(255,255,255,0.35)'}
        style={{ marginTop: pressed ? lip.rest : 0 }}
        contentStyle={{
          minHeight: small ? 40 : 50,
          paddingHorizontal: small ? space.md : space.xl,
          paddingVertical: small ? space.xs : space.sm,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
        }}
      >
        {loading ? <ActivityIndicator color={t.ink} /> : icon}
        <Text variant="label" color={t.ink} style={{ fontSize: small ? 14 : 16 }} numberOfLines={1}>
          {label}
        </Text>
      </PixelBox>
    </Pressable>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  const theme = useTheme();
  const [pressed, setPressed] = useState(false);
  const flat = StyleSheet.flatten(style) ?? {};
  const { backgroundColor, opacity, ...inner } = flat;
  const body = (
    <PixelBox
      face={(backgroundColor as string) ?? theme.color.surface}
      border={theme.dark ? theme.color.surfaceAlt : theme.color.outline}
      lip={theme.color.cardLip}
      lipHeight={pressed ? 2 : lip.rest + 2}
      style={{ marginTop: pressed ? lip.rest : 0, opacity: opacity as number | undefined }}
      contentStyle={[{ padding: space.lg }, inner]}
    >
      {children}
    </PixelBox>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}>
      {body}
    </Pressable>
  );
}

export function Chip({ label, color, ink, icon, style }: { label: string; color?: string; ink?: string; icon?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: color ?? theme.color.surfaceAlt,
        borderRadius: radius.chip,
        borderWidth: 2,
        borderColor: theme.dark ? theme.color.surfaceAlt : theme.color.outline,
        paddingHorizontal: space.sm,
        paddingVertical: 2,
        ...StyleSheet.flatten(style),
      }}
    >
      {icon}
      <Text variant="caption" color={ink ?? theme.color.ink} style={{ fontFamily: type.label.fontFamily }}>
        {label}
      </Text>
    </View>
  );
}

export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[{ flex: 1, backgroundColor: theme.color.canvas }, style]}>{children}</View>;
}

export function Loading({ label = 'Rowing out…' }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, backgroundColor: theme.color.canvas }}>
      <ActivityIndicator size="large" color={theme.color.secondary} />
      <Text color={theme.color.inkSoft}>{label}</Text>
    </View>
  );
}

export function SectionHeader({ title, count }: { title: string; count?: number }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xl, marginBottom: space.sm }}>
      <Text variant="title">{title}</Text>
      {count !== undefined && count > 0 && <Chip label={String(count)} color={theme.color.primary} ink={theme.color.onPrimary} />}
    </View>
  );
}

export function Banner({ tone = 'danger', text, onDismiss }: { tone?: 'danger' | 'info'; text: string; onDismiss?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onDismiss}
      accessibilityRole="alert"
      style={{
        backgroundColor: tone === 'danger' ? theme.color.danger : theme.color.secondary,
        borderRadius: radius.chip,
        borderWidth: 3,
        borderBottomWidth: 6,
        borderColor: theme.color.outline,
        padding: space.md,
      }}
    >
      <Text variant="label" color={tone === 'danger' ? theme.color.onDanger : theme.color.onSecondary}>
        {text}
      </Text>
    </Pressable>
  );
}
