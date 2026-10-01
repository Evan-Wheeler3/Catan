import { RESOURCES, RESOURCE_LABEL, type ResourceCounts } from '@tideholm/engine';
import { useEffect } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { ResourceIcon } from '../ui/icons';
import { Text } from '../ui/primitives';
import { useSettings } from '../theme/settings';
import { palette, resourceColors } from '../theme/tokens';

const CARD_W = 58;
const CARD_H = 80;

function ResourceCard({ resource, count, angle, offsetY }: { resource: (typeof RESOURCES)[number]; count: number; angle: number; offsetY: number }) {
  const { theme, reduceMotion } = useSettings();
  const bump = useSharedValue(1);
  useEffect(() => {
    if (!reduceMotion) bump.value = withSequence(withTiming(1.12, { duration: 110 }), withSpring(1, { damping: 8 }));
  }, [count, reduceMotion, bump]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: offsetY }, { rotate: `${angle}deg` }, { scale: bump.value }] }));
  return (
    <Animated.View
      style={[{ width: CARD_W, height: CARD_H, marginHorizontal: -6 }, style]}
      accessibilityLabel={`${count} ${RESOURCE_LABEL[resource]}`}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: theme.dark ? '#2E2342' : '#FFFFFF',
          borderRadius: 12,
          borderWidth: 2,
          borderColor: theme.color.outline,
          borderBottomWidth: 5,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 26, backgroundColor: resourceColors[resource], opacity: 0.85 }} />
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 4, borderWidth: 2, borderColor: palette.inkberry, marginTop: 4 }}>
          <ResourceIcon resource={resource} size={26} />
        </View>
        <Text variant="caption" style={{ marginTop: 2, fontSize: 11 }} numberOfLines={1}>
          {RESOURCE_LABEL[resource]}
        </Text>
      </View>
      <View
        style={{
          position: 'absolute',
          top: -8,
          right: -4,
          minWidth: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: theme.color.primary,
          borderWidth: 2,
          borderColor: theme.color.outline,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
        }}
      >
        <Text variant="number" color={theme.color.onPrimary} style={{ fontSize: 15, lineHeight: 18 }}>
          {count}
        </Text>
      </View>
    </Animated.View>
  );
}

/** The player's resource cards, fanned along the bottom edge. */
export function HandFan({ hand }: { hand: ResourceCounts }) {
  const { theme } = useSettings();
  const { width } = useWindowDimensions();
  const held = RESOURCES.filter((r) => hand[r] > 0);
  const n = held.length;
  if (n === 0) {
    return (
      <View style={{ height: CARD_H, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="caption" color={theme.color.inkSoft}>
          No cards yet — build next to busy numbers to collect more.
        </Text>
      </View>
    );
  }
  const spread = Math.min(8, 30 / Math.max(1, n - 1));
  return (
    <View style={{ height: CARD_H + 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', maxWidth: width }} accessibilityLabel="Your hand">
      {held.map((r, i) => {
        const centered = i - (n - 1) / 2;
        return <ResourceCard key={r} resource={r} count={hand[r]} angle={centered * spread} offsetY={Math.abs(centered) * Math.abs(centered) * 2.2} />;
      })}
    </View>
  );
}
