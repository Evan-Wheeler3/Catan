import type { Resource } from '@tideholm/engine';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { ResourceIcon } from '../ui/icons';
import { palette, resourceColors } from '../theme/tokens';

export interface Flight {
  id: string;
  resource: Resource;
  from: { x: number; y: number };
  to: { x: number; y: number };
  delay: number;
}

function FlyingCard({ flight, onDone }: { flight: Flight; onDone: (id: string) => void }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(flight.delay, withTiming(1, { duration: 750, easing: Easing.inOut(Easing.cubic) }, (fin) => fin && runOnJS(onDone)(flight.id)));
  }, [t, flight, onDone]);
  const style = useAnimatedStyle(() => {
    const { from, to } = flight;
    // Quadratic bezier with a lift so cards arc up before dropping into the hand.
    const cx = (from.x + to.x) / 2;
    const cy = Math.min(from.y, to.y) - 120;
    const u = t.value;
    const x = (1 - u) * (1 - u) * from.x + 2 * (1 - u) * u * cx + u * u * to.x;
    const y = (1 - u) * (1 - u) * from.y + 2 * (1 - u) * u * cy + u * u * to.y;
    return {
      opacity: u === 0 ? 0 : 1 - Math.max(0, u - 0.85) * 6,
      transform: [{ translateX: x - 18 }, { translateY: y - 24 }, { rotate: `${(u - 0.5) * 40}deg` }, { scale: 0.7 + Math.sin(u * Math.PI) * 0.5 }],
    };
  });
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, style]} pointerEvents="none">
      <View style={{ width: 36, height: 48, borderRadius: 8, borderWidth: 2, borderColor: palette.inkberry, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderTopWidth: 10, borderTopColor: resourceColors[flight.resource] }}>
        <ResourceIcon resource={flight.resource} size={22} />
      </View>
    </Animated.View>
  );
}

/** Resource cards flying from producing tiles into the player's hand. */
export function FlyingCards({ flights, onDone }: { flights: Flight[]; onDone: (id: string) => void }) {
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} pointerEvents="none">
      {flights.map((f) => (
        <FlyingCard key={f.id} flight={f} onDone={onDone} />
      ))}
    </View>
  );
}
