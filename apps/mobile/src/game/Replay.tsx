import { describeEvent } from '@tideholm/engine';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import type { SeatInfo } from '../data/connection';
import { Avatar } from '../ui/Avatar';
import { Button, Text } from '../ui/primitives';
import { useSettings } from '../theme/settings';
import { radius, seatStyles, space } from '../theme/tokens';
import type { ReplayState } from './useGame';

function actorOf(e: ReplayState['steps'][number]['event']): number | null {
  if ('seat' in e && typeof e.seat === 'number') return e.seat;
  if (e.type === 'stole') return e.thief;
  if (e.type === 'tradeOffered') return e.offer.from;
  if (e.type === 'tradeResolved') return e.by;
  if (e.type === 'awardChanged') return e.holder;
  return null;
}

/** "Since you were last here": steps through other players' moves while pieces drop in. */
export function ReplayCard({
  replay,
  seats,
  viewer,
  onNext,
  onDone,
}: {
  replay: ReplayState;
  seats: SeatInfo[];
  viewer: number | null;
  onNext: () => void;
  onDone: () => void;
}) {
  const { theme, reduceMotion } = useSettings();
  const finished = replay.index >= replay.steps.length;
  const step = replay.steps[Math.min(replay.index, replay.steps.length - 1)];
  const names = seats.map((s) => s.name);

  useEffect(() => {
    if (finished) return;
    const t = setTimeout(onNext, reduceMotion ? 1600 : 1100);
    return () => clearTimeout(t);
  }, [replay.index, finished, onNext, reduceMotion]);

  const actor = actorOf(step.event);
  const text = describeEvent(step.event, names, viewer) ?? '';
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 84,
        left: space.md,
        right: space.md,
        backgroundColor: theme.color.surface,
        borderRadius: radius.card,
        borderWidth: 2,
        borderColor: theme.color.outline,
        borderBottomWidth: 6,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        gap: 6,
      }}
      accessibilityLiveRegion="polite"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="title">{finished ? "You're all caught up" : 'Since you were last here'}</Text>
        <Text variant="caption" color={theme.color.inkSoft}>
          {Math.min(replay.index + 1, replay.steps.length)}/{replay.steps.length}
        </Text>
      </View>
      {!finished && (
        <Animated.View key={replay.index} entering={reduceMotion ? undefined : FadeInDown.springify().damping(16)} exiting={reduceMotion ? undefined : FadeOut} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 40 }}>
          {actor !== null && seats[actor] && <Avatar id={seats[actor].avatar} size={34} ring={seatStyles[actor].color} />}
          <Text style={{ flex: 1 }}>{text}</Text>
        </Animated.View>
      )}
      <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.color.surfaceAlt, overflow: 'hidden' }}>
        <View style={{ height: 6, width: `${(Math.min(replay.index, replay.steps.length) / replay.steps.length) * 100}%`, backgroundColor: theme.color.secondary }} />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {!finished && <Button small tone="plain" label="Skip" onPress={onDone} style={{ flex: 1 }} />}
        <Button small tone={finished ? 'primary' : 'secondary'} label={finished ? "Let's play" : 'Next'} onPress={finished ? onDone : onNext} style={{ flex: 1 }} />
      </View>
    </View>
  );
}
