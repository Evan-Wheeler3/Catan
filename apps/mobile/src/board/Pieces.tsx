// Game pieces as small SVGs inside animated views, so each can "drop" in with a bounce.
// Every piece carries its seat's color, roof pattern and crest so seats are distinguishable
// without relying on color.
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, Path, Pattern, Rect } from 'react-native-svg';
import { palette, seatStyles, type SeatStyle } from '../theme/tokens';

const INK = palette.inkberry;

function SeatPattern({ id, style }: { id: string; style: SeatStyle }) {
  const mark = style.ink === '#FFFFFF' ? 'rgba(255,255,255,0.55)' : 'rgba(42,31,61,0.35)';
  return (
    <Pattern id={id} width={6} height={6} patternUnits="userSpaceOnUse">
      <Rect width={6} height={6} fill={style.color} />
      {style.pattern === 'stripes' && <Path d="M-1 7 L7 -1 M-1 1 L1 -1 M5 7 L7 5" stroke={mark} strokeWidth={1.6} />}
      {style.pattern === 'dots' && <Circle cx={3} cy={3} r={1.3} fill={mark} />}
      {style.pattern === 'checks' && (
        <G>
          <Rect width={3} height={3} fill={mark} />
          <Rect x={3} y={3} width={3} height={3} fill={mark} />
        </G>
      )}
    </Pattern>
  );
}

export function Crest({ shape, x, y, r, fill }: { shape: SeatStyle['crest']; x: number; y: number; r: number; fill: string }) {
  const common = { fill, stroke: INK, strokeWidth: 1.2 };
  switch (shape) {
    case 'circle':
      return <Circle cx={x} cy={y} r={r} {...common} />;
    case 'triangle':
      return <Path d={`M${x} ${y - r * 1.15} L${x + r * 1.1} ${y + r * 0.8} H${x - r * 1.1} Z`} {...common} strokeLinejoin="round" />;
    case 'square':
      return <Rect x={x - r * 0.9} y={y - r * 0.9} width={r * 1.8} height={r * 1.8} rx={1} {...common} />;
    case 'diamond':
      return <Path d={`M${x} ${y - r * 1.2} L${x + r * 1.1} ${y} L${x} ${y + r * 1.2} L${x - r * 1.1} ${y} Z`} {...common} strokeLinejoin="round" />;
  }
}

export function OutpostSvg({ seat, size = 30 }: { seat: number; size?: number }) {
  const st = seatStyles[seat];
  const pid = `p-o-${seat}`;
  return (
    <Svg width={size} height={size * 1.1} viewBox="0 0 30 33">
      <Defs>
        <SeatPattern id={pid} style={st} />
      </Defs>
      <Ellipse cx={15} cy={29} rx={13} ry={3.5} fill={INK} opacity={0.3} />
      <Path d="M5 14 L15 5 L25 14 V28 H5 Z" fill={st.color} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M2.5 15 L15 3.5 L27.5 15 L25 17 L15 8 L5 17 Z" fill={`url(#${pid})`} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <Crest shape={st.crest} x={15} y={21} r={3.6} fill={st.ink === '#FFFFFF' ? '#FFFFFF' : st.light} />
    </Svg>
  );
}

export function TownSvg({ seat, size = 42 }: { seat: number; size?: number }) {
  const st = seatStyles[seat];
  const pid = `p-t-${seat}`;
  return (
    <Svg width={size} height={size * 0.95} viewBox="0 0 42 40">
      <Defs>
        <SeatPattern id={pid} style={st} />
      </Defs>
      <Ellipse cx={21} cy={35.5} rx={19} ry={4} fill={INK} opacity={0.3} />
      <Path d="M4 20 H24 V35 H4 Z" fill={st.color} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M22 12 L30 4 L38 12 V35 H22 Z" fill={st.color} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <Path d="M2 21 L14 12 L26 21 Z" fill={`url(#${pid})`} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M20 13 L30 2.5 L40 13 Z" fill={`url(#${pid})`} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <Rect x={27} y={16} width={6} height={6} rx={1} fill="#FFE7A0" stroke={INK} strokeWidth={1.4} />
      <Crest shape={st.crest} x={14} y={28} r={3.8} fill={st.ink === '#FFFFFF' ? '#FFFFFF' : st.light} />
    </Svg>
  );
}

export function TrailSvg({ seat, length }: { seat: number; length: number }) {
  const st = seatStyles[seat];
  const pid = `p-r-${seat}`;
  const h = 11;
  return (
    <Svg width={length} height={h + 4} viewBox={`0 0 ${length} ${h + 4}`}>
      <Defs>
        <SeatPattern id={pid} style={st} />
      </Defs>
      <Rect x={1} y={3} width={length - 2} height={h} rx={h / 2} fill={INK} opacity={0.3} />
      <Rect x={1} y={1} width={length - 2} height={h} rx={h / 2} fill={`url(#${pid})`} stroke={INK} strokeWidth={2} />
    </Svg>
  );
}

export function RaiderSvg({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.25} viewBox="0 0 34 42">
      <Ellipse cx={17} cy={38} rx={13} ry={3.5} fill={INK} opacity={0.35} />
      <Path d="M6 37 Q6 20 17 18 Q28 20 28 37 Z" fill="#3B2D52" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <Circle cx={17} cy={13} r={9} fill="#3B2D52" stroke={INK} strokeWidth={2.2} />
      <Path d="M8.5 11 Q17 6 25.5 11 L25.5 14 Q17 10 8.5 14 Z" fill={palette.hibiscus} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M25 12 l5 -2 l-1 5 z" fill={palette.hibiscus} stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />
      <Circle cx={13.5} cy={16} r={1.6} fill="#FFFFFF" />
      <Circle cx={20.5} cy={16} r={1.6} fill="#FFFFFF" />
      <Path d="M10 28 H24" stroke={palette.hibiscus} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Positions a piece at board coordinates and, when `animate` is set, drops it in from
 * above with an overshooting spring. Reduced motion → a plain fade.
 */
export function Placed({
  x,
  y,
  w,
  h,
  rotate = 0,
  animate,
  reduceMotion,
  children,
  delay = 0,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  rotate?: number;
  animate?: boolean;
  reduceMotion?: boolean;
  children: ReactNode;
  delay?: number;
}) {
  const drop = useSharedValue(animate && !reduceMotion ? -36 : 0);
  const squash = useSharedValue(1);
  const opacity = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) return;
    if (reduceMotion) {
      opacity.value = withTiming(1, { duration: 200 });
      return;
    }
    opacity.value = withDelay(delay, withTiming(1, { duration: 90 }));
    drop.value = withDelay(delay, withSpring(0, { damping: 9, stiffness: 260, mass: 0.7 }));
    squash.value = withDelay(delay + 140, withSequence(withTiming(0.82, { duration: 70 }), withSpring(1, { damping: 6, stiffness: 300 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ rotate: `${rotate}deg` }, { translateY: drop.value }, { scaleY: squash.value }, { scaleX: 2 - squash.value }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, alignItems: 'center', justifyContent: 'center' }, style]}>
      {children}
    </Animated.View>
  );
}

/** A pulsing glow, used to mark legal placement spots. Static ring under reduced motion. */
export function Glow({ size, reduceMotion, color, shape = 'circle', length }: { size: number; reduceMotion: boolean; color: string; shape?: 'circle' | 'capsule'; length?: number }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!reduceMotion) pulse.value = withRepeat(withTiming(1, { duration: 1200 }), -1, true);
  }, [reduceMotion, pulse]);
  const style = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0.9 : 0.55 + pulse.value * 0.45,
    transform: [{ scale: reduceMotion ? 1 : 0.92 + pulse.value * 0.14 }],
  }));
  const w = shape === 'capsule' ? (length ?? size) : size;
  const h = shape === 'capsule' ? 16 : size;
  return (
    <Animated.View style={[{ width: w, height: h, alignItems: 'center', justifyContent: 'center' }, style]}>
      <View
        style={{
          width: w,
          height: h,
          borderRadius: h / 2,
          backgroundColor: `${color}66`,
          borderWidth: 3,
          borderColor: color,
        }}
      />
      {shape === 'circle' && <View style={{ position: 'absolute', width: size * 0.3, height: size * 0.3, borderRadius: size, backgroundColor: color, borderWidth: 2, borderColor: INK }} />}
    </Animated.View>
  );
}
