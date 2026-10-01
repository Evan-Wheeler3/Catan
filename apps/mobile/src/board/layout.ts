import { latticeToPixel, topology } from '@tideholm/engine';

/** Center-to-corner hex radius in board units. */
export const HEX = 60;
export const OCEAN_MARGIN = 84;

const topo = topology();

const raw = {
  hexes: topo.hexes.map((h) => latticeToPixel(h.x, h.y, HEX)),
  vertices: topo.vertices.map((v) => latticeToPixel(v.x, v.y, HEX)),
};
const xs = raw.vertices.map((p) => p.x);
const ys = raw.vertices.map((p) => p.y);
const minX = Math.min(...xs) - OCEAN_MARGIN;
const minY = Math.min(...ys) - OCEAN_MARGIN;

export const BOARD_W = Math.max(...xs) - Math.min(...xs) + OCEAN_MARGIN * 2;
export const BOARD_H = Math.max(...ys) - Math.min(...ys) + OCEAN_MARGIN * 2;
export const CENTER = { x: -minX, y: -minY };

const shift = (p: { x: number; y: number }) => ({ x: p.x - minX, y: p.y - minY });

export const hexPos = raw.hexes.map(shift);
export const vertexPos = raw.vertices.map(shift);
export const edgePos = topo.edges.map((e) => {
  const a = vertexPos[e.vertices[0]];
  const b = vertexPos[e.vertices[1]];
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
    length: Math.hypot(b.x - a.x, b.y - a.y),
  };
});

export function hexCorners(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((-90 + 60 * i) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

/** Pointy-top hexagon with rounded corners. */
export function roundedHexPath(cx: number, cy: number, r: number, round = 6): string {
  const pts = hexCorners(cx, cy, r);
  const lerp = (p: { x: number; y: number }, q: { x: number; y: number }, t: number) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  const t = round / r;
  let d = '';
  pts.forEach((p, i) => {
    const prev = pts[(i + 5) % 6];
    const next = pts[(i + 1) % 6];
    const a = lerp(p, prev, t);
    const b = lerp(p, next, t);
    d += `${i === 0 ? 'M' : 'L'}${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${p.x.toFixed(1)} ${p.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)} `;
  });
  return `${d}Z`;
}

/** Unit vector pointing from the island center out through a point (for harbors). */
export function outward(p: { x: number; y: number }) {
  const dx = p.x - CENTER.x;
  const dy = p.y - CENTER.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}
