import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Rect } from 'react-native-svg';
import { useSettings } from '../theme/settings';
import { palette } from '../theme/tokens';

const PIPS: Record<number, [number, number][]> = {
  1: [[12, 12]],
  2: [[7, 7], [17, 17]],
  3: [[7, 7], [12, 12], [17, 17]],
  4: [[7, 7], [17, 7], [7, 17], [17, 17]],
  5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
  6: [[7, 7], [17, 7], [7, 12], [17, 12], [7, 17], [17, 17]],
};

function Die({ value, size, rollKey, delay, red }: { value: number; size: number; rollKey: number; delay: number; red?: boolean }) {
  const { reduceMotion } = useSettings();
  const spin = useSharedValue(0);
  const lift = useSharedValue(0);
  const squash = useSharedValue(1);
  useEffect(() => {
    if (!rollKey || reduceMotion) return;
    spin.value = 0;
    spin.value = withTiming(720 + delay, { duration: 700, easing: Easing.out(Easing.cubic) });
    lift.value = withSequence(withTiming(-22, { duration: 220, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 7, stiffness: 240 }));
    squash.value = withSequence(withTiming(1, { duration: 420 }), withTiming(0.8, { duration: 70 }), withSpring(1, { damping: 6 }));
  }, [rollKey, reduceMotion, spin, lift, squash, delay]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { rotate: `${spin.value}deg` }, { scaleY: squash.value }],
  }));
  return (
    <Animated.View style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 26">
        <Rect x={1.2} y={3} width={21.6} height={21.6} rx={6} fill={red ? '#B32E50' : '#C7B79A'} stroke={palette.inkberry} strokeWidth={2} />
        <Rect x={1.2} y={1.2} width={21.6} height={21.6} rx={6} fill={red ? palette.hibiscus : '#FFF8EA'} stroke={palette.inkberry} strokeWidth={2} />
        {PIPS[value]?.map(([x, y], i) => (
          <Circle key={i} cx={x} cy={y} r={2.1} fill={red ? '#FFFFFF' : palette.inkberry} />
        ))}
      </Svg>
    </Animated.View>
  );
}

/** Two chunky dice. `rollKey` changes trigger the tumble animation. */
export function Dice({ dice, rollKey, size = 34 }: { dice: [number, number] | null; rollKey: number; size?: number }) {
  const shown = dice ?? [6, 6];
  const seven = dice ? dice[0] + dice[1] === 7 : false;
  return (
    <View
      style={{ flexDirection: 'row', gap: 6, opacity: dice ? 1 : 0.35 }}
      accessibilityRole="image"
      accessibilityLabel={dice ? `Dice show ${shown[0]} and ${shown[1]}, total ${shown[0] + shown[1]}` : 'Dice not rolled yet'}
    >
      <Die value={shown[0]} size={size} rollKey={rollKey} delay={0} red={seven} />
      <Die value={shown[1]} size={size} rollKey={rollKey} delay={90} red={seven} />
    </View>
  );
}
