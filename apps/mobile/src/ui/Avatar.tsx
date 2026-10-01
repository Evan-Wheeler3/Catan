// Original sea-creature avatars, drawn as simple duotone SVGs on a colored disc.
import { Pressable, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { useTheme } from '../theme/settings';
import { palette, radius, space } from '../theme/tokens';

export const AVATARS = ['gull', 'turtle', 'crab', 'puffin', 'otter', 'whale', 'octopus', 'seal'] as const;
export type AvatarId = (typeof AVATARS)[number];

const BG: Record<AvatarId, string> = {
  gull: '#BFE3F2',
  turtle: '#B9E4B4',
  crab: '#FFC9B5',
  puffin: '#FFE09A',
  otter: '#E8D2B8',
  whale: '#A9C9F5',
  octopus: '#F2C2DF',
  seal: '#D7DCE5',
};

const ink = palette.inkberry;
const s = { stroke: ink, strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function Face({ id }: { id: AvatarId }) {
  switch (id) {
    case 'gull':
      return (
        <G {...s}>
          <Path d="M12 30 q8 -16 20 -14 q12 2 14 14 q-6 8 -17 8 q-11 0 -17 -8 z" fill="#FFFFFF" />
          <Path d="M40 24 l9 3 l-9 3 z" fill={palette.marigold} />
          <Circle cx={33} cy={23} r={2} fill={ink} />
        </G>
      );
    case 'turtle':
      return (
        <G {...s}>
          <Ellipse cx={30} cy={34} rx={16} ry={11} fill="#4F9D52" />
          <Path d="M22 30 l8 -5 l8 5 l-3 8 h-10 z" fill="#93CF5F" strokeWidth={1.6} />
          <Circle cx={30} cy={18} r={7} fill="#93CF5F" />
          <Circle cx={27.5} cy={17} r={1.4} fill={ink} />
          <Circle cx={32.5} cy={17} r={1.4} fill={ink} />
        </G>
      );
    case 'crab':
      return (
        <G {...s}>
          <Path d="M14 22 q-4 -8 2 -10 l2 6 M46 22 q4 -8 -2 -10 l-2 6" fill="none" />
          <Ellipse cx={30} cy={34} rx={15} ry={10} fill={palette.hibiscus} />
          <Path d="M24 25 v-6 M36 25 v-6" fill="none" />
          <Circle cx={24} cy={18} r={2.6} fill="#FFFFFF" />
          <Circle cx={36} cy={18} r={2.6} fill="#FFFFFF" />
          <Path d="M25 37 q5 4 10 0" fill="none" />
        </G>
      );
    case 'puffin':
      return (
        <G {...s}>
          <Circle cx={30} cy={30} r={15} fill={ink} />
          <Ellipse cx={30} cy={32} rx={10} ry={11} fill="#FFFFFF" />
          <Path d="M30 30 l9 4 l-9 5 z" fill="#FF8A3D" />
          <Circle cx={25} cy={27} r={1.6} fill={ink} />
          <Circle cx={35} cy={27} r={1.6} fill={ink} />
        </G>
      );
    case 'otter':
      return (
        <G {...s}>
          <Circle cx={18} cy={18} r={4} fill="#A9744A" />
          <Circle cx={42} cy={18} r={4} fill="#A9744A" />
          <Circle cx={30} cy={31} r={15} fill="#A9744A" />
          <Ellipse cx={30} cy={37} rx={8} ry={6} fill="#F1DDC4" />
          <Circle cx={24} cy={28} r={1.8} fill={ink} />
          <Circle cx={36} cy={28} r={1.8} fill={ink} />
          <Ellipse cx={30} cy={34} rx={2.4} ry={1.6} fill={ink} />
        </G>
      );
    case 'whale':
      return (
        <G {...s}>
          <Path d="M10 34 q2 -16 22 -16 q16 0 16 14 q0 8 -12 8 h-14 q-12 0 -12 -6 z" fill="#3A7BD5" />
          <Path d="M10 34 q8 6 26 6" fill="none" />
          <Path d="M30 18 q-2 -6 -6 -7 M30 18 q2 -6 6 -7" fill="none" />
          <Circle cx={40} cy={28} r={1.8} fill={ink} />
        </G>
      );
    case 'octopus':
      return (
        <G {...s}>
          <Path d="M16 34 q0 -20 14 -20 q14 0 14 20" fill="#B56CC8" />
          <Path d="M16 34 q-2 8 4 8 M24 34 q-1 8 3 9 M33 34 q1 8 -3 9 M44 34 q2 8 -4 8" fill="none" />
          <Circle cx={25} cy={27} r={2} fill={ink} />
          <Circle cx={35} cy={27} r={2} fill={ink} />
        </G>
      );
    case 'seal':
      return (
        <G {...s}>
          <Circle cx={30} cy={30} r={15} fill="#9AA3B5" />
          <Circle cx={24} cy={27} r={2} fill={ink} />
          <Circle cx={36} cy={27} r={2} fill={ink} />
          <Ellipse cx={30} cy={34} rx={3} ry={2} fill={ink} />
          <Path d="M20 35 h-6 M20 38 h-5 M40 35 h6 M40 38 h5" fill="none" strokeWidth={1.4} />
        </G>
      );
  }
}

export function Avatar({ id, size = 48, ring }: { id: string | null | undefined; size?: number; ring?: string }) {
  const avatar = (AVATARS as readonly string[]).includes(id ?? '') ? (id as AvatarId) : 'gull';
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60" accessibilityLabel={`${avatar} avatar`}>
      <Circle cx={30} cy={30} r={28} fill={BG[avatar]} stroke={ring ?? ink} strokeWidth={ring ? 4 : 2.5} />
      <Face id={avatar} />
    </Svg>
  );
}

export function AvatarPicker({ value, onChange }: { value: string; onChange: (a: string) => void }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'center' }} accessibilityRole="radiogroup">
      {AVATARS.map((a) => (
        <Pressable
          key={a}
          onPress={() => onChange(a)}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === a }}
          accessibilityLabel={a}
          style={{ padding: 4, borderRadius: radius.pill, borderWidth: 3, borderColor: value === a ? theme.color.primary : 'transparent' }}
        >
          <Avatar id={a} size={64} />
        </Pressable>
      ))}
    </View>
  );
}

