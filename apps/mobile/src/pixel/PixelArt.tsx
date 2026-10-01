import { memo, useSyncExternalStore } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { PixelCanvas, type Art, type ColorPath, type Palette, type Sprite } from './canvas';
export { canvasArt, type Art } from './canvas';

export const PixelPaths = memo(function PixelPaths({ paths }: { paths: ColorPath[] }) {
  return (
    <>
      {paths.map((p) => (
        <Path key={`${p.fill}${p.opacity ?? ''}`} d={p.d} fill={p.fill} opacity={p.opacity} />
      ))}
    </>
  );
});

export const PixelSvg = memo(function PixelSvg({
  paths,
  width,
  height,
  style,
}: {
  paths: ColorPath[];
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={style} pointerEvents="none">
      <PixelPaths paths={paths} />
    </Svg>
  );
});

const spriteCache = new Map<string, Art>();

/** A sprite flattened to unit-cell paths (scale it with a viewBox). Cached by key. */
export function spriteArt(key: string, sprite: Sprite, palette: Palette): Art {
  let art = spriteCache.get(key);
  if (!art) {
    const cv = new PixelCanvas();
    cv.sprite(sprite, 0, 0, palette);
    const w = Math.max(...sprite.map((r) => r.length));
    art = { paths: cv.toPaths(1), w, h: sprite.length };
    spriteCache.set(key, art);
  }
  return art;
}

/** Renders a sprite centered in a square box, with integer-ish cells for crispness. */
export function PixelIcon({ art, size, box = 12 }: { art: Art; size: number; box?: number }) {
  const span = Math.max(box, art.w, art.h);
  const ox = (span - art.w) / 2;
  const oy = (span - art.h) / 2;
  return (
    <Svg width={size} height={size} viewBox={`${-Math.floor(ox)} ${-Math.floor(oy)} ${span} ${span}`} accessibilityElementsHidden importantForAccessibility="no">
      <PixelPaths paths={art.paths} />
    </Svg>
  );
}

// --- A shared, stepped animation clock (6 fps, like an old console) -----------------

let frame = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(l: () => void) {
  listeners.add(l);
  if (!timer) {
    timer = setInterval(() => {
      frame = (frame + 1) % 960;
      listeners.forEach((fn) => fn());
    }, 1000 / 6);
  }
  return () => {
    listeners.delete(l);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const noop = () => () => {};

/** Current animation frame; frozen at 0 when `paused` (reduced motion). */
export function useArcadeFrame(paused: boolean): number {
  return useSyncExternalStore(paused ? noop : subscribe, () => (paused ? 0 : frame));
}
