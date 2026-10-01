import { forwardRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../theme/settings';
import { radius, space, type } from '../theme/tokens';
import { Text } from './primitives';

export const Field = forwardRef<TextInput, TextInputProps & { label: string; hint?: string; error?: string | null }>(function Field(
  { label, hint, error, style, ...rest },
  ref,
) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={theme.color.inkFaint}
        accessibilityLabel={label}
        accessibilityHint={hint}
        style={[
          type.body,
          {
            color: theme.color.ink,
            backgroundColor: theme.color.surface,
            borderRadius: radius.chip,
            borderWidth: 3,
            borderBottomWidth: 5,
            borderColor: error ? theme.color.danger : theme.color.outline,
            paddingHorizontal: space.md,
            paddingVertical: space.md,
            minHeight: 52,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" color={theme.color.danger}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color={theme.color.inkSoft}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
