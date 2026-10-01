import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { PixelCanvas } from '../pixel/canvas';
import { canvasArt, PixelIcon, type Art } from '../pixel/PixelArt';
import { useSettings } from '../theme/settings';
import { palette } from '../theme/tokens';

const PIPS: Record<number, [number, number][]> = {
  1: [[5, 5]],
  2: [[2, 2], [8, 8]],
  3: [[2, 2], [5, 5], [8, 8]],
  4: [[2, 2], [8, 2], [2, 8], [8, 8]],
  5: [[2, 2], [8, 2], [5, 5], [2, 8], [8, 8]],
  6: [[2, 2], [8, 2], [2, 5], [8, 5], [2, 8], [8, 8]],
};

const cache = new Map<string, Art>();
function dieArt(value: number, red: boolean): Art {
  const k = `${value}${red}`;
  let a = cache.get(k);
  if (!a) {
    const cv = new PixelCanvas();
    const face = red ? palette.hibiscus : '#FFF8EA';
    const lip = red ? '#A3203F' : '#BFA978';
    // Stepped-corner die with a 2-cell lip for thickness.
    for (let y = 0; y < 14; y++) {
      for (let x = 0; x < 12; x++) {
        const corner = (x === 0 || x === 11) && (y === 0 || y === 13);
        if (corner) continue;
        const edge = x === 0 || x === 11 || y === 0 || y === 13 || ((x === 1 || x === 10) && (y === 1 || y === 12));
        cv.set(x, y, edge ? palette.inkberry : y >= 11 ? lip : face);
      }
    }
    cv.rect(2, 1, 6, 1, '#FFFFFF');
    for (const [x, y] of PIPS[value]) cv.rect(x, y, 2, 2, red ? '#FFFFFF' : palette.inkberry);
    a = canvasArt(cv, 1);
    cache.set(k, a);
  }
  return a;
}

function Die({ value, size, rollKey, delay, red }: { value: number; size: number; rollKey: number; delay: number; red?: boolean }) {
  const { reduceMotion } = useSettings();
  const [shown, setShown] = useState(value);
  const hop = useSharedValue(0);
  useEffect(() => {
    if (!rollKey || reduceMotion) {
      setShown(value);
      return;
    }
    // Tumble: flick through random faces, hopping in whole-pixel steps, then land.
    let n = 0;
    const t = setInterval(() => {
      n++;
      setShown(n >= 8 ? value : 1 + Math.floor(Math.random() * 6));
      if (n >= 8) clearInterval(t);
    }, 70);
    const step = (y: number, d: number) => withDelay(d, withTiming(y, { duration: 0 }));
    hop.value = withDelay(delay, withSequence(step(-12, 0), step(-18, 90), step(-12, 90), step(0, 90), step(-6, 140), step(0, 90)));
    return () => clearInterval(t);
  }, [rollKey, value, reduceMotion, hop, delay]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: hop.value }] }));
  return (
    <Animated.View style={style}>
      <PixelIcon art={dieArt(shown, !!red)} size={size} box={14} />
    </Animated.View>
  );
}

/** Two chunky pixel dice. `rollKey` changes trigger the tumble. */
export function Dice({ dice, rollKey, size = 36 }: { dice: [number, number] | null; rollKey: number; size?: number }) {
  const shown = dice ?? [6, 6];
  const seven = dice ? dice[0] + dice[1] === 7 : false;
  return (
    <View
      style={{ flexDirection: 'row', gap: 4, opacity: dice ? 1 : 0.35 }}
      accessibilityRole="image"
      accessibilityLabel={dice ? `Dice show ${shown[0]} and ${shown[1]}, total ${shown[0] + shown[1]}` : 'Dice not rolled yet'}
    >
      <Die value={shown[0]} size={size} rollKey={rollKey} delay={0} red={seven} />
      <Die value={shown[1]} size={size} rollKey={rollKey} delay={60} red={seven} />
    </View>
  );
}
