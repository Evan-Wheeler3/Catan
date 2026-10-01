import { useEffect, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../theme/settings';
import { radius, space } from '../theme/tokens';
import { Icon } from './icons';
import { Text } from './primitives';

/** Bottom sheet with a chunky top edge. Slides up with a spring (fades if reduced motion). */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  dismissable = true,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  dismissable?: boolean;
}) {
  const { theme, reduceMotion } = useSettings();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(400);
  useEffect(() => {
    if (visible) y.value = reduceMotion ? withTiming(0, { duration: 1 }) : withSpring(0, { damping: 18, stiffness: 180 });
    else y.value = 400;
  }, [visible, reduceMotion, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? 'fade' : 'none'} onRequestClose={dismissable ? onClose : () => {}} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: theme.color.scrim }} onPress={dismissable ? onClose : undefined} accessibilityLabel="Close" />
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: '86%',
            backgroundColor: theme.color.surface,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            borderWidth: 2,
            borderBottomWidth: 0,
            borderColor: theme.color.outline,
            paddingBottom: insets.bottom + space.lg,
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: -12 },
            elevation: 16,
          },
          style,
        ]}
        accessibilityViewIsModal
      >
        <View style={{ alignItems: 'center', paddingTop: space.sm }}>
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: theme.color.surfaceAlt }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.sm }}>
          <Text variant="heading" style={{ flex: 1 }} accessibilityRole="header">
            {title}
          </Text>
          {dismissable && (
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="close" size={22} />
            </Pressable>
          )}
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.md, gap: space.md }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
