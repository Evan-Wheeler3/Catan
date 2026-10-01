// Pixel-art sea-creature avatars on a stepped round badge.
import { Pressable, View } from 'react-native';
import { PixelCanvas } from '../pixel/canvas';
import { AVATAR_PALETTE, AVATAR_SPRITES } from '../pixel/icons';
import { canvasArt, PixelIcon, type Art } from '../pixel/PixelArt';
import { useTheme } from '../theme/settings';
import { palette, radius, space } from '../theme/tokens';

export const AVATARS = ['gull', 'turtle', 'crab', 'puffin', 'otter', 'whale', 'octopus', 'seal'] as const;
export type AvatarId = (typeof AVATARS)[number];

const BG: Record<AvatarId, string> = {
  gull: '#BFE3F2',
  turtle: '#D4F0B4',
  crab: '#FFD6C7',
  puffin: '#FFE09A',
  otter: '#EAD9C3',
  whale: '#BFD8FA',
  octopus: '#F2CBE4',
  seal: '#DCE1EA',
};

const cache = new Map<string, Art>();

function avatarArt(id: AvatarId, ring: string): Art {
  const k = `${id}${ring}`;
  let art = cache.get(k);
  if (!art) {
    const cv = new PixelCanvas();
    // 22-cell stepped disc: ring color, ink outline, tinted face.
    for (let y = 0; y < 22; y++) {
      for (let x = 0; x < 22; x++) {
        const d = Math.hypot(x - 10.5, y - 10.5);
        if (d <= 11) cv.set(x, y, d > 10 ? palette.inkberry : d > 8.6 ? ring : BG[id]);
      }
    }
    const spr = AVATAR_SPRITES[id];
    cv.sprite(spr, 3, Math.round(11 - spr.length / 2) + 1, AVATAR_PALETTE);
    art = canvasArt(cv, 1);
    cache.set(k, art);
  }
  return art;
}

export function Avatar({ id, size = 48, ring }: { id: string | null | undefined; size?: number; ring?: string }) {
  const avatar = (AVATARS as readonly string[]).includes(id ?? '') ? (id as AvatarId) : 'gull';
  return (
    <View accessibilityRole="image" accessibilityLabel={`${avatar} avatar`}>
      <PixelIcon art={avatarArt(avatar, ring ?? palette.inkberry)} size={size} box={22} />
    </View>
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
