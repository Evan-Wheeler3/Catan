// Duotone 24-grid glyphs: 2.5px rounded ink stroke + one flat fill. All original.
import type { FortuneKind, Resource } from '@tideholm/engine';
import Svg, { Circle, Ellipse, G, Path, Polygon, Rect } from 'react-native-svg';
import { useTheme } from '../theme/settings';
import { palette, resourceColors } from '../theme/tokens';

const SW = 2.2;

interface GlyphProps {
  size?: number;
  ink?: string;
}

/** Resource glyph, drawn so it can be reused inside the board SVG via <G>. */
export function ResourceGlyph({ resource, ink = palette.inkberry }: { resource: Resource; ink?: string }) {
  const common = { stroke: ink, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (resource) {
    case 'timber':
      return (
        <G {...common}>
          <Rect x={3} y={12} width={18} height={6} rx={3} fill="#B9783F" />
          <Rect x={6} y={6} width={15} height={6} rx={3} fill="#D0914F" />
          <Circle cx={6} cy={15} r={2.6} fill="#F1C98E" />
          <Circle cx={9} cy={9} r={2.6} fill="#F1C98E" />
          <Circle cx={6} cy={15} r={0.7} fill={ink} strokeWidth={0} />
          <Circle cx={9} cy={9} r={0.7} fill={ink} strokeWidth={0} />
        </G>
      );
    case 'clay':
      return (
        <G {...common}>
          <Path d="M3 10 L7 6 H21 V15 L17 19 H3 Z" fill="#E08A5C" />
          <Path d="M3 10 H17 V19 M17 10 L21 6" fill="none" />
          <Path d="M7 13.5 q2 -1.6 4 0 t4 0" fill="none" strokeWidth={1.6} />
        </G>
      );
    case 'fleece':
      return (
        <G {...common}>
          <Path d="M6 17 v3 M10 17 v3 M15 17 v3 M18 17 v3" fill="none" />
          <Path
            d="M5 15 a3 3 0 0 1 0.5 -5.5 a3.2 3.2 0 0 1 5.5 -2.5 a3.2 3.2 0 0 1 5.5 0.5 a3 3 0 0 1 3 5 a2.8 2.8 0 0 1 -2.5 4 h-10 a2.8 2.8 0 0 1 -2 -1.5 z"
            fill="#FFFFFF"
          />
          <Ellipse cx={19.5} cy={11.5} rx={2.4} ry={3} fill={ink} />
        </G>
      );
    case 'grain':
      return (
        <G {...common}>
          <Path d="M12 21 V9 M12 21 L8 10 M12 21 L16 10" fill="none" />
          <Ellipse cx={12} cy={6} rx={2} ry={3.6} fill="#F7D873" />
          <Ellipse cx={7.5} cy={7.5} rx={1.8} ry={3.2} fill="#F7D873" transform="rotate(-20 7.5 7.5)" />
          <Ellipse cx={16.5} cy={7.5} rx={1.8} ry={3.2} fill="#F7D873" transform="rotate(20 16.5 7.5)" />
          <Rect x={9} y={14.5} width={6} height={2.6} rx={1} fill="#C66A3D" />
        </G>
      );
    case 'stone':
      return (
        <G {...common}>
          <Polygon points="4,15 7,7 14,4 20,9 20,16 13,20" fill="#A4ACBD" />
          <Path d="M7 7 L11 12 L20 9 M11 12 L13 20 M11 12 L4 15" fill="none" strokeWidth={1.6} />
        </G>
      );
  }
}

export function ResourceIcon({ resource, size = 24 }: { resource: Resource } & GlyphProps) {
  const theme = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {/* On dark surfaces glyphs sit on a pale token so their ink outlines stay legible. */}
      {theme.dark && <Circle cx={12} cy={12} r={11.5} fill="#E6F2EE" />}
      <G transform={theme.dark ? 'translate(2.4 2.4) scale(0.8)' : undefined}>
        <ResourceGlyph resource={resource} ink={palette.inkberry} />
      </G>
    </Svg>
  );
}

export type IconName =
  | 'dice'
  | 'hammer'
  | 'trade'
  | 'fortune'
  | 'flag'
  | 'bell'
  | 'friends'
  | 'gear'
  | 'plus'
  | 'check'
  | 'close'
  | 'back'
  | 'crown'
  | 'scroll'
  | 'boat'
  | 'share'
  | 'clock'
  | 'trail'
  | 'shield'
  | 'island';

export function Icon({ name, size = 24, ink, fill }: GlyphProps & { name: IconName; fill?: string }) {
  const theme = useTheme();
  const c = ink ?? theme.color.ink;
  const f = fill ?? theme.color.primary;
  const s = { stroke: c, strokeWidth: SW, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  const body = (() => {
    switch (name) {
      case 'dice':
        return (
          <G {...s}>
            <Rect x={3} y={3} width={18} height={18} rx={5} fill={f} />
            {[[8, 8], [16, 16], [12, 12], [16, 8], [8, 16]].map(([x, y]) => (
              <Circle key={`${x}${y}`} cx={x} cy={y} r={1.4} fill={c} strokeWidth={0} />
            ))}
          </G>
        );
      case 'hammer':
        return (
          <G {...s}>
            <Path d="M13 10 L5 18 a1.5 1.5 0 0 0 2 2 L15 12" fill={theme.color.surface} />
            <Path d="M10 6 L15 3 L21 9 L18 12 L15 9 L12 10 Z" fill={f} />
          </G>
        );
      case 'trade':
        return (
          <G {...s} fill="none">
            <Path d="M4 8 H18 M14 4 L18 8 L14 12" />
            <Path d="M20 16 H6 M10 12 L6 16 L10 20" />
          </G>
        );
      case 'fortune':
        return (
          <G {...s}>
            <Rect x={5} y={3} width={14} height={18} rx={3} fill={f} />
            <Path d="M12 7.5 L13.4 10.6 L16.6 11 L14.2 13.2 L14.9 16.4 L12 14.8 L9.1 16.4 L9.8 13.2 L7.4 11 L10.6 10.6 Z" fill={theme.color.surface} strokeWidth={1.4} />
          </G>
        );
      case 'flag':
        return (
          <G {...s}>
            <Path d="M6 21 V4" fill="none" />
            <Path d="M6 4 H18 L15 8 L18 12 H6" fill={f} />
          </G>
        );
      case 'bell':
        return (
          <G {...s}>
            <Path d="M6 17 V11 a6 6 0 0 1 12 0 V17 L19.5 19 H4.5 Z" fill={f} />
            <Path d="M10 21 h4" fill="none" />
          </G>
        );
      case 'friends':
        return (
          <G {...s}>
            <Circle cx={9} cy={8} r={3.5} fill={f} />
            <Path d="M2.5 20 a6.5 6.5 0 0 1 13 0 Z" fill={f} />
            <Circle cx={17} cy={9} r={2.8} fill={theme.color.surface} />
            <Path d="M16 20 h6 a5 5 0 0 0 -7 -5" fill="none" />
          </G>
        );
      case 'gear':
        return (
          <G {...s}>
            <Path
              d="M12 2.8 l1.6 2.2 2.6 -0.6 0.7 2.6 2.6 0.8 -0.6 2.6 2.1 1.6 -2.1 1.6 0.6 2.6 -2.6 0.8 -0.7 2.6 -2.6 -0.6 -1.6 2.2 -1.6 -2.2 -2.6 0.6 -0.7 -2.6 -2.6 -0.8 0.6 -2.6 -2.1 -1.6 2.1 -1.6 -0.6 -2.6 2.6 -0.8 0.7 -2.6 2.6 0.6 Z"
              fill={f}
            />
            <Circle cx={12} cy={12} r={3} fill={theme.color.surface} />
          </G>
        );
      case 'plus':
        return <Path {...s} d="M12 5 V19 M5 12 H19" fill="none" strokeWidth={3} />;
      case 'check':
        return <Path {...s} d="M5 12.5 L10 17 L19 7" fill="none" strokeWidth={3} />;
      case 'close':
        return <Path {...s} d="M6 6 L18 18 M18 6 L6 18" fill="none" strokeWidth={3} />;
      case 'back':
        return <Path {...s} d="M15 5 L8 12 L15 19" fill="none" strokeWidth={3} />;
      case 'crown':
        return <Path {...s} d="M3 18 L5 7 L9.5 12 L12 5 L14.5 12 L19 7 L21 18 Z" fill={f} />;
      case 'scroll':
        return (
          <G {...s}>
            <Path d="M7 4 H18 a2 2 0 0 1 2 2 V18 a2 2 0 0 1 -2 2 H8" fill={theme.color.surface} />
            <Path d="M7 4 a2 2 0 0 0 -2 2 V17 a3 3 0 0 0 3 3 a3 3 0 0 0 3 -3 V16 H5" fill={f} />
            <Path d="M11 8 H16 M11 12 H16" fill="none" />
          </G>
        );
      case 'boat':
        return (
          <G {...s}>
            <Path d="M12 3 V15 M12 4 L19 13 H12" fill={theme.color.surface} />
            <Path d="M3 15 H21 L18 20 H6 Z" fill={f} />
          </G>
        );
      case 'share':
        return (
          <G {...s} fill="none">
            <Path d="M12 15 V3 M7 8 L12 3 L17 8" />
            <Path d="M5 12 V19 a2 2 0 0 0 2 2 H17 a2 2 0 0 0 2 -2 V12" />
          </G>
        );
      case 'clock':
        return (
          <G {...s}>
            <Circle cx={12} cy={12} r={9} fill={f} />
            <Path d="M12 7 V12 L15.5 14" fill="none" />
          </G>
        );
      case 'trail':
        return (
          <G {...s}>
            <Rect x={2} y={10} width={20} height={5} rx={2.5} fill={f} transform="rotate(-30 12 12.5)" />
          </G>
        );
      case 'shield':
        return <Path {...s} d="M12 3 L20 6 V12 c0 5 -3.5 8 -8 9.5 C7.5 20 4 17 4 12 V6 Z" fill={f} />;
      case 'island':
        return (
          <G {...s}>
            <Path d="M2 18 q5 -3 10 0 t10 0" fill="none" />
            <Path d="M5 16 q7 -8 14 0" fill={f} />
            <Path d="M12 13 V6 M12 6 q-4 -1 -6 2 M12 6 q4 -1 6 2" fill="none" />
          </G>
        );
    }
  })();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {body}
    </Svg>
  );
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

