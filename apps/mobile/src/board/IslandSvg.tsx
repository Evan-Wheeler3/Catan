// The static board layer: shelf, beach, terrain tiles, number discs and harbors.
// Memoized on the board itself, so it renders once per game.
import { PIPS, topology, type Board, type HarborKind, type Terrain } from '@tideholm/engine';
import { memo } from 'react';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { ResourceGlyph } from '../ui/icons';
import { fonts, palette, terrainColors } from '../theme/tokens';
import { BOARD_H, BOARD_W, HEX, edgePos, hexPos, outward, roundedHexPath, vertexPos } from './layout';

const INK = palette.inkberry;

function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Path d="M0 -12 L7 -1 H3 L8 6 H-8 L-3 -1 H-7 Z" fill="#1F5C39" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <Line x1={0} y1={6} x2={0} y2={10} stroke={INK} strokeWidth={2} strokeLinecap="round" />
    </G>
  );
}

function Peak({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(${s})`}>
      <Path d="M-12 7 L-2 -10 L4 -2 L7 -6 L13 7 Z" fill="#5E6678" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M-5 -5 L-2 -10 L1 -6 L-1 -4 Z" fill="#FFFFFF" />
    </G>
  );
}

function Tuft({ x, y }: { x: number; y: number }) {
  return <Path d={`M${x - 4} ${y} q2 -6 4 -7 M${x} ${y} v-8 M${x + 4} ${y} q-2 -6 -4 -7`} stroke="#4F8A33" strokeWidth={1.8} fill="none" strokeLinecap="round" />;
}

function Sheep({ x, y }: { x: number; y: number }) {
  return (
    <G transform={`translate(${x} ${y})`}>
      <Path d="M-5 3 v3 M3 3 v3" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
      <Ellipse cx={0} cy={0} rx={8} ry={5.5} fill="#FFFFFF" stroke={INK} strokeWidth={1.6} />
      <Ellipse cx={8} cy={-1} rx={2.8} ry={3.2} fill={INK} />
    </G>
  );
}

function Stalk({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <Line x1={x} y1={y} x2={x} y2={y - 12} stroke="#B98C1E" strokeWidth={1.6} strokeLinecap="round" />
      <Ellipse cx={x} cy={y - 14} rx={2.2} ry={4} fill="#F7D873" stroke={INK} strokeWidth={1.2} />
    </G>
  );
}

function Bricks({ x, y }: { x: number; y: number }) {
  return (
    <G transform={`translate(${x} ${y})`} stroke={INK} strokeWidth={1.4} strokeLinejoin="round">
      <Path d="M-10 0 h9 v5 h-9 z" fill="#E08A5C" />
      <Path d="M0 0 h9 v5 h-9 z" fill="#E08A5C" />
      <Path d="M-5 -5 h9 v5 h-9 z" fill="#F0A57A" />
    </G>
  );
}

function TerrainArt({ terrain, cx, cy }: { terrain: Terrain; cx: number; cy: number }) {
  switch (terrain) {
    case 'grove':
      return (
        <G>
          <Tree x={cx - 24} y={cy - 20} />
          <Tree x={cx} y={cy - 32} s={1.15} />
          <Tree x={cx + 24} y={cy - 20} />
          <Tree x={cx - 30} y={cy + 20} s={0.8} />
          <Tree x={cx + 30} y={cy + 20} s={0.8} />
        </G>
      );
    case 'claypit':
      return (
        <G>
          <Path d={`M${cx - 36} ${cy - 14} q12 -14 24 0 z`} fill="#9C4D27" opacity={0.7} />
          <Path d={`M${cx + 12} ${cy - 18} q12 -14 24 0 z`} fill="#9C4D27" opacity={0.7} />
          <Bricks x={cx} y={cy - 28} />
          <Path d={`M${cx - 28} ${cy + 22} h12 M${cx + 16} ${cy + 22} h12`} stroke="#9C4D27" strokeWidth={2} strokeLinecap="round" />
        </G>
      );
    case 'meadow':
      return (
        <G>
          <Sheep x={cx - 2} y={cy - 30} />
          <Tuft x={cx - 28} y={cy - 14} />
          <Tuft x={cx + 28} y={cy - 14} />
          <Tuft x={cx - 26} y={cy + 26} />
          <Tuft x={cx + 26} y={cy + 26} />
        </G>
      );
    case 'fields':
      return (
        <G>
          {[-30, -18, 18, 30].map((dx) => (
            <Path key={dx} d={`M${cx + dx - 6} ${cy + 26} q6 -40 12 -54`} stroke="#C99D2A" strokeWidth={1.4} fill="none" opacity={0.7} />
          ))}
          <Stalk x={cx - 8} y={cy - 18} />
          <Stalk x={cx} y={cy - 22} />
          <Stalk x={cx + 8} y={cy - 18} />
        </G>
      );
    case 'crags':
      return (
        <G>
          <Peak x={cx - 18} y={cy - 22} />
          <Peak x={cx + 14} y={cy - 28} s={1.2} />
          <Peak x={cx + 28} y={cy + 20} s={0.7} />
          <Peak x={cx - 28} y={cy + 22} s={0.7} />
        </G>
      );
    case 'dunes':
      return (
        <G>
          {[-18, -4, 10, 24].map((dy) => (
            <Path key={dy} d={`M${cx - 30} ${cy + dy} q15 -8 30 0 t30 0`} stroke="#CDB57C" strokeWidth={2} fill="none" strokeLinecap="round" />
          ))}
          <Circle cx={cx + 14} cy={cy - 30} r={4} fill="#FFFFFF" stroke={INK} strokeWidth={1.4} />
        </G>
      );
  }
}

/** A number token that reads as a physical disc: hard contact shadow, thickness lip, face. */
export function NumberDisc({ cx, cy, token, dim }: { cx: number; cy: number; token: number; dim?: boolean }) {
  const red = token === 6 || token === 8;
  const pips = PIPS[token] ?? 0;
  return (
    <G opacity={dim ? 0.45 : 1}>
      <Ellipse cx={cx + 1} cy={cy + 5} rx={18} ry={14} fill={INK} opacity={0.22} />
      <Circle cx={cx} cy={cy + 3} r={17} fill="#B9D6CD" stroke={INK} strokeWidth={2} />
      <Circle cx={cx} cy={cy} r={17} fill="#F7FBF8" stroke={INK} strokeWidth={2} />
      <SvgText
        x={cx}
        y={cy + 4}
        fontFamily={fonts.display}
        fontSize={token === 2 || token === 12 ? 15 : 18}
        fill={red ? palette.hibiscus : INK}
        textAnchor="middle"
      >
        {String(token)}
      </SvgText>
      {Array.from({ length: pips }, (_, i) => (
        <Circle key={i} cx={cx + (i - (pips - 1) / 2) * 3.6} cy={cy + 10} r={1.3} fill={red ? palette.hibiscus : INK} />
      ))}
    </G>
  );
}

function HarborBadge({ edge, kind }: { edge: number; kind: HarborKind }) {
  const topo = topology();
  const m = edgePos[edge];
  const o = outward(m);
  const bx = m.x + o.x * 38;
  const by = m.y + o.y * 38;
  const [a, b] = topo.edges[edge].vertices.map((v) => vertexPos[v]);
  return (
    <G>
      {[a, b].map((p, i) => (
        <G key={i}>
          <Line x1={p.x} y1={p.y} x2={bx + (p.x - m.x) * 0.25} y2={by + (p.y - m.y) * 0.25} stroke="#8B5A2B" strokeWidth={6} strokeLinecap="round" />
          <Line x1={p.x} y1={p.y} x2={bx + (p.x - m.x) * 0.25} y2={by + (p.y - m.y) * 0.25} stroke="#C99560" strokeWidth={3} strokeLinecap="round" strokeDasharray="4 3" />
        </G>
      ))}
      <Ellipse cx={bx + 1} cy={by + 4} rx={17} ry={14} fill={INK} opacity={0.25} />
      <Circle cx={bx} cy={by} r={16} fill="#FFFFFF" stroke={INK} strokeWidth={2.2} />
      {kind === 'any' ? (
        <SvgText x={bx} y={by + 5} fontFamily={fonts.display} fontSize={14} fill={INK} textAnchor="middle">
          3:1
        </SvgText>
      ) : (
        <G>
          <G transform={`translate(${bx - 10} ${by - 13}) scale(0.84)`}>
            <ResourceGlyph resource={kind} />
          </G>
          <SvgText x={bx} y={by + 13} fontFamily={fonts.display} fontSize={9} fill={INK} textAnchor="middle">
            2:1
          </SvgText>
        </G>
      )}
    </G>
  );
}

export const IslandSvg = memo(function IslandSvg({ board, raiderHex }: { board: Board; raiderHex: number }) {
  return (
    <Svg width={BOARD_W} height={BOARD_H} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs>
        {(Object.keys(terrainColors) as Terrain[]).map((t) => (
          <LinearGradient key={t} id={`g-${t}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={terrainColors[t][0]} />
            <Stop offset="0.55" stopColor={terrainColors[t][1]} />
            <Stop offset="1" stopColor={terrainColors[t][2]} />
          </LinearGradient>
        ))}
      </Defs>
      {/* Shallow-water shelf, then beach, then tiles. */}
      {hexPos.map((p, i) => (
        <Path key={`shelf${i}`} d={roundedHexPath(p.x, p.y, HEX + 20, 16)} fill="#7FE0D2" opacity={0.55} />
      ))}
      {hexPos.map((p, i) => (
        <Path key={`sand${i}`} d={roundedHexPath(p.x, p.y + 4, HEX + 8, 10)} fill="#E9D3A0" />
      ))}
      {hexPos.map((p, i) => (
        <Path key={`beach${i}`} d={roundedHexPath(p.x, p.y, HEX + 7, 10)} fill="#F6E7C1" />
      ))}
      {board.harbors.map((h) => (
        <HarborBadge key={h.edge} edge={h.edge} kind={h.kind} />
      ))}
      {board.hexes.map((tile, i) => {
        const p = hexPos[i];
        return (
          <G key={`hex${i}`}>
            {/* Tile thickness: a darker copy offset downward reads as a chunky physical tile. */}
            <Path d={roundedHexPath(p.x, p.y + 4, HEX - 2.5, 7)} fill={terrainColors[tile.terrain][2]} stroke={INK} strokeWidth={2} />
            <Path d={roundedHexPath(p.x, p.y, HEX - 2.5, 7)} fill={`url(#g-${tile.terrain})`} stroke={INK} strokeWidth={2} />
            <Path d={roundedHexPath(p.x, p.y, HEX - 9, 6)} fill="none" stroke="#FFFFFF" strokeOpacity={0.18} strokeWidth={2} />
            <TerrainArt terrain={tile.terrain} cx={p.x} cy={p.y} />
            {tile.token !== null && <NumberDisc cx={p.x} cy={p.y + 10} token={tile.token} dim={i === raiderHex} />}
          </G>
        );
      })}
    </Svg>
  );
});
