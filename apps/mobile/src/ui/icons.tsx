// Pixel icons. 'K' takes the theme ink and 'm' the accent fill, so one sprite works on light,
// dark and colored buttons.
import type { FortuneKind, Resource } from '@tideholm/engine';
import { ICON_FIXED, ICON_SPRITES, RESOURCE_PALETTE, RESOURCE_SPRITES, type IconName } from '../pixel/icons';
import { PixelIcon, spriteArt } from '../pixel/PixelArt';
import { useTheme } from '../theme/settings';
import { resourceColors } from '../theme/tokens';

export type { IconName };

export function ResourceIcon({ resource, size = 24 }: { resource: Resource; size?: number }) {
  const art = spriteArt(`res-${resource}`, RESOURCE_SPRITES[resource], RESOURCE_PALETTE);
  return <PixelIcon art={art} size={size} />;
}

export function Icon({ name, size = 24, ink, fill }: { name: IconName; size?: number; ink?: string; fill?: string }) {
  const theme = useTheme();
  const K = ink ?? theme.color.ink;
  const m = fill ?? theme.color.primary;
  const art = spriteArt(`icon-${name}-${K}-${m}`, ICON_SPRITES[name], { ...ICON_FIXED, K, m });
  return <PixelIcon art={art} size={size} />;
}

export const FORTUNE_ICON: Record<FortuneKind, IconName> = {
  warden: 'shield',
  trailblazer: 'trail',
  windfall: 'boat',
  embargo: 'scroll',
  relic: 'crown',
};

export function resourceTint(r: Resource) {
  return resourceColors[r];
}
