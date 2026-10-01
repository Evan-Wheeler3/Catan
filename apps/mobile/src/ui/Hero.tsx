// The Tideholm wordmark island: a few tiles from the board on a little sea.
import Svg, { Ellipse, G, Path } from 'react-native-svg';
import { roundedHexPath } from '../board/layout';
import { palette, terrainColors } from '../theme/tokens';

export function HeroIsland({ size = 220 }: { size?: number }) {
  const tiles: [number, number, keyof typeof terrainColors][] = [
    [80, 64, 'grove'],
    [140, 64, 'fields'],
    [50, 116, 'meadow'],
    [110, 116, 'crags'],
    [170, 116, 'claypit'],
  ];
  return (
    <Svg width={size} height={size * 0.8} viewBox="0 0 220 176" accessibilityElementsHidden importantForAccessibility="no">
      <Ellipse cx={110} cy={150} rx={104} ry={20} fill={palette.lagoon} opacity={0.35} />
      <Path d="M10 156 q12 -8 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0" stroke={palette.lagoon} strokeWidth={4} fill="none" strokeLinecap="round" />
      {tiles.map(([x, y, t]) => (
        <G key={`${x}${y}`}>
          <Path d={roundedHexPath(x, y + 6, 33, 6)} fill={terrainColors[t][2]} stroke={palette.inkberry} strokeWidth={2.5} />
          <Path d={roundedHexPath(x, y, 33, 6)} fill={terrainColors[t][1]} stroke={palette.inkberry} strokeWidth={2.5} />
        </G>
      ))}
      <Path d="M104 98 L114 89 L124 98 V112 H104 Z" fill="#D55E00" stroke={palette.inkberry} strokeWidth={2.5} strokeLinejoin="round" />
      <Path d="M101 99 L114 87 L127 99" fill="none" stroke={palette.inkberry} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
