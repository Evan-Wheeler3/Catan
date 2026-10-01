// Pixel-art pieces, aligned to the board's cell grid. Each lives in its own animated view so
// it can drop in with a bounce; seats differ by roof color, roof pattern and wall crest.
import { topology } from '@tideholm/engine';
import { useEffect, type ReactNode } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { PixelCanvas } from '../pixel/canvas';
import { canvasArt, PixelIcon, PixelSvg, spriteArt, type Art } from '../pixel/PixelArt';
import { crestSprite, drawOutpost, drawTown, INK, PAL, RAIDER, type SeatArt } from '../pixel/sprites';
import { seatStyles } from '../theme/tokens';
import { CELL, hexCell, pieceOrigin, TOKEN_DY, vertexCell } from './raster';

export function seatArt(seat: number): SeatArt {
  const s = seatStyles[seat];
  return { roof: s.color, roofDark: s.dark, mark: s.mark, crest: s.crest, pattern: s.pattern };
}

interface Placement {
  art: Art;
  left: number;
  top: number;
}

const pieceCache = new Map<string, Placement>();

/** Outpost/town art for a seat at a vertex, in board units. */
export function buildingPlacement(kind: 'outpost' | 'town', seat: number, vertex: number): Placement {
  const k = `${kind}-${seat}`;
  let base = pieceCache.get(k);
  if (!base) {
    const cv = new PixelCanvas();
    (kind === 'outpost' ? drawOutpost : drawTown)(cv, seatArt(seat));
    const a = canvasArt(cv, CELL);
    base = { art: a, left: a.x0, top: a.y0 };
    pieceCache.set(k, base);
  }
  const o = pieceOrigin(kind, vertex);
  return { art: base.art, left: (o.x + base.left) * CELL, top: (o.y + base.top) * CELL };
}

/** A trail as a chunky pixel staircase between two corners, patterned per seat. */
export function trailPlacement(edge: number, seat: number): Placement {
  const k = `trail-${edge}-${seat}`;
  let p = pieceCache.get(k);
  if (p) return p;
  const [va, vb] = topology().edges[edge].vertices.map(vertexCell);
  const st = seatStyles[seat];
  const cv = new PixelCanvas();
  const ax = va.x + (vb.x - va.x) * 0.2;
  const ay = va.y + (vb.y - va.y) * 0.2;
  const bx = va.x + (vb.x - va.x) * 0.8;
  const by = va.y + (vb.y - va.y) * 0.8;
  const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
  const x0 = Math.floor(Math.min(ax, bx)) - 3;
  const x1 = Math.ceil(Math.max(ax, bx)) + 3;
  const y0 = Math.floor(Math.min(ay, by)) - 3;
  const y1 = Math.ceil(Math.max(ay, by)) + 3;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2));
      const d = Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
      if (d <= 1.3) {
        const marked =
          st.pattern === 'stripes' ? (x + y) % 3 === 0 : st.pattern === 'dots' ? x % 2 === 0 && y % 2 === 0 : st.pattern === 'checks' ? (x + y) % 2 === 0 : false;
        cv.set(x, y, marked ? st.mark : st.color);
      } else if (d <= 2.4) cv.set(x, y, INK);
    }
  }
  const a = canvasArt(cv, CELL);
  p = { art: a, left: a.x0 * CELL, top: a.y0 * CELL };
  pieceCache.set(k, p);
  return p;
}

let raiderArt: Art | null = null;
export function raiderPlacement(hex: number): Placement {
  if (!raiderArt) {
    const cv = new PixelCanvas();
    cv.sprite(RAIDER, 0, 0, PAL);
    raiderArt = canvasArt(cv, CELL);
  }
  const c = hexCell(hex);
  return { art: raiderArt, left: (c.x + 8) * CELL, top: (c.y + TOKEN_DY - 9) * CELL };
}

/**
 * Positions art in board units and, when `animate` is set, drops it in from above with an
 * overshooting spring. Reduced motion → a plain fade.
 */
export function Placed({
  p,
  animate,
  reduceMotion,
  bob,
  children,
}: {
  p: Placement;
  animate?: boolean;
  reduceMotion?: boolean;
  bob?: boolean;
  children?: ReactNode;
}) {
  const drop = useSharedValue(animate && !reduceMotion ? -36 : 0);
  const squash = useSharedValue(1);
  const opacity = useSharedValue(animate ? 0 : 1);
  const idle = useSharedValue(0);
  useEffect(() => {
    if (bob && !reduceMotion) {
      // Stepped idle bob: jumps a whole pixel, like a sprite animation.
      idle.value = withRepeat(withSequence(withDelay(420, withTiming(-CELL, { duration: 0 })), withDelay(420, withTiming(0, { duration: 0 }))), -1);
    }
    if (!animate) return;
    if (reduceMotion) {
      opacity.value = withTiming(1, { duration: 200 });
      return;
    }
    opacity.value = withTiming(1, { duration: 90 });
    drop.value = withSpring(0, { damping: 9, stiffness: 260, mass: 0.7 });
    squash.value = withDelay(140, withSequence(withTiming(0.8, { duration: 70 }), withSpring(1, { damping: 6, stiffness: 300 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: drop.value + idle.value }, { scaleY: squash.value }, { scaleX: 2 - squash.value }],
  }));
  const w = p.art.w * CELL;
  const h = p.art.h * CELL;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: p.left, top: p.top, width: w, height: h, transformOrigin: 'bottom' }, style]}>
      {children ?? <PixelSvg paths={p.art.paths} width={w} height={h} />}
    </Animated.View>
  );
}

// --- Selection cursors ------------------------------------------------------------

function ring(r: number, color: string): PixelCanvas {
  const cv = new PixelCanvas();
  const n = Math.ceil(r) + 2;
  for (let y = -n; y <= n; y++) {
    for (let x = -n; x <= n; x++) {
      const d = Math.hypot(x, y);
      if (d <= r + 0.5 && d > r - 1.6) cv.set(x, y, color);
      else if (d <= r + 1.5 && d > r + 0.5) cv.set(x, y, INK);
      else if (d <= r - 1.6 && d > r - 2.6) cv.set(x, y, INK);
    }
  }
  // A glint so the ring pops on light tiles too.
  cv.set(-Math.round(r * 0.6), -Math.round(r * 0.6), '#FFFFFF');
  cv.rect(-1, -1, 3, 3, INK);
  cv.set(0, 0, color);
  return cv;
}

function brackets(half: number, color: string): PixelCanvas {
  const cv = new PixelCanvas();
  const arm = 4;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (let k = 0; k < arm; k++) {
        for (const [x, y] of [
          [sx * (half - k), sy * half],
          [sx * half, sy * (half - k)],
        ]) {
          cv.set(x, y, color);
          cv.set(x + sx, y, INK);
          cv.set(x, y + sy, INK);
        }
      }
    }
  }
  return cv;
}

const cursorCache = new Map<string, Art & { x0: number; y0: number }>();
export function cursorArt(kind: 'vertex' | 'edge' | 'hex', color: string) {
  const k = `${kind}${color}`;
  let a = cursorCache.get(k);
  if (!a) {
    a = canvasArt(kind === 'hex' ? brackets(10, color) : ring(kind === 'vertex' ? 5 : 3.8, color), CELL);
    cursorCache.set(k, a);
  }
  return a;
}

/** Blinking pixel cursor marking a legal spot (static under reduced motion). */
export function PixelCursor({ kind, color, reduceMotion }: { kind: 'vertex' | 'edge' | 'hex'; color: string; reduceMotion: boolean }) {
  const art = cursorArt(kind, color);
  const blink = useSharedValue(1);
  useEffect(() => {
    if (!reduceMotion) blink.value = withRepeat(withSequence(withDelay(380, withTiming(0.6, { duration: 0 })), withDelay(380, withTiming(1, { duration: 0 }))), -1);
  }, [reduceMotion, blink]);
  const style = useAnimatedStyle(() => ({ opacity: blink.value }));
  return (
    <Animated.View style={style} pointerEvents="none">
      <PixelSvg paths={art.paths} width={art.w * CELL} height={art.h * CELL} />
    </Animated.View>
  );
}

/** A seat's crest as a small pixel badge for UI (rail, confetti, legends). */
export function PixelCrest({ seat, size = 14 }: { seat: number; size?: number }) {
  const st = seatStyles[seat];
  const spr = crestSprite(st.crest).map((r) => r.replace(/#/g, 'c'));
  const outlined = ['.......', ...spr.map((r) => `.${r}.`), '.......'];
  // Add an ink outline around the crest so light seat colors stay visible.
  const grid = outlined.map((r) => r.split(''));
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] !== '.') continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grid[y + dy]?.[x + dx] === 'c');
      if (near) grid[y][x] = 'K';
    }
  }
  const art = spriteArt(`crest${seat}`, grid.map((r) => r.join('')), { c: st.color, K: INK });
  return <PixelIcon art={art} size={size} box={7} />;
}
