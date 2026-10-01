import type { PlayerView } from '@tideholm/engine';
import { useEffect, useMemo } from 'react';
import { Modal, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import Svg from 'react-native-svg';
import type { SeatInfo } from '../data/connection';
import { Crest } from '../board/Pieces';
import { useFeedback } from '../lib/feedback';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/icons';
import { Button, Text } from '../ui/primitives';
import { useSettings } from '../theme/settings';
import { radius, seatStyles, space } from '../theme/tokens';

function Confetto({ i, width, height }: { i: number; width: number; height: number }) {
  const fall = useSharedValue(0);
  const seat = i % 4;
  const x = (i * 73) % width;
  const dur = 2400 + ((i * 37) % 1600);
  useEffect(() => {
    fall.value = withDelay((i * 53) % 900, withRepeat(withTiming(1, { duration: dur, easing: Easing.linear }), -1, false));
  }, [fall, i, dur]);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x + Math.sin(fall.value * 6 + i) * 24 },
      { translateY: -40 + fall.value * (height + 80) },
      { rotate: `${fall.value * 720 + i * 20}deg` },
    ],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', top: 0, left: 0 }, style]} pointerEvents="none">
      <Svg width={16} height={16} viewBox="0 0 14 14">
        <Crest shape={seatStyles[seat].crest} x={7} y={7} r={5} fill={seatStyles[seat].color} />
      </Svg>
    </Animated.View>
  );
}

/** Celebratory end screen: confetti in player crests, a stamped banner, final scores (relics revealed). */
export function WinOverlay({ view, seats, onHome, onRematch }: { view: PlayerView; seats: SeatInfo[]; onHome: () => void; onRematch?: () => void }) {
  const { theme, reduceMotion } = useSettings();
  const { success, play } = useFeedback();
  const { width, height } = useWindowDimensions();
  const winner = view.phase.kind === 'ended' ? view.phase.winner : 0;
  const iWon = winner === view.viewer;
  const stamp = useSharedValue(reduceMotion ? 1 : 2.4);
  useEffect(() => {
    success();
    play('win');
    if (!reduceMotion) stamp.value = withSpring(1, { damping: 9, stiffness: 140 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const stampStyle = useAnimatedStyle(() => ({ transform: [{ scale: stamp.value }, { rotate: `${(stamp.value - 1) * -12}deg` }], opacity: Math.min(1, 3 - stamp.value) }));
  const ranked = useMemo(() => [...view.players].sort((a, b) => (b.totalVP ?? b.publicVP) - (a.totalVP ?? a.publicVP)), [view.players]);

  return (
    <Modal transparent animationType="fade" statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: theme.color.scrim, justifyContent: 'center', padding: space.xl }}>
        {!reduceMotion && Array.from({ length: 36 }, (_, i) => <Confetto key={i} i={i} width={width} height={height} />)}
        <Animated.View
          style={[
            { backgroundColor: theme.color.surface, borderRadius: radius.sheet, borderWidth: 3, borderColor: theme.color.outline, borderBottomWidth: 8, padding: space.xl, gap: space.lg, alignItems: 'center' },
            stampStyle,
          ]}
          accessibilityRole="alert"
        >
          <View style={{ alignItems: 'center' }}>
            <Icon name="crown" size={44} />
            <Avatar id={seats[winner]?.avatar} size={84} ring={seatStyles[winner].color} />
          </View>
          <Text variant="display" style={{ textAlign: 'center' }}>
            {iWon ? 'You won!' : `${seats[winner]?.name} wins!`}
          </Text>
          <Text color={theme.color.inkSoft} style={{ textAlign: 'center' }}>
            {iWon ? 'The island is yours. Beautifully built.' : 'A well-fought island. Rematch?'}
          </Text>
          <View style={{ alignSelf: 'stretch', gap: space.sm }}>
            {ranked.map((p) => (
              <View key={p.seat} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Avatar id={seats[p.seat]?.avatar} size={30} ring={seatStyles[p.seat].color} />
                <Text variant="label" style={{ flex: 1 }}>
                  {p.seat === view.viewer ? 'You' : seats[p.seat]?.name}
                </Text>
                <Text variant="number">{p.totalVP ?? p.publicVP} pts</Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm, alignSelf: 'stretch' }}>
            <Button tone="plain" label="Harbor" onPress={onHome} style={{ flex: 1 }} />
            {onRematch && <Button label="Rematch" onPress={onRematch} style={{ flex: 1 }} />}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
