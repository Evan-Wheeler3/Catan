// The board: an animated ocean, the island, pieces, and glowing tap targets — with
// pinch-to-zoom, pan, and double-tap to reset.
import { topology, type Board, type Building, type Seat } from '@tideholm/engine';
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { ColorPath } from '../pixel/canvas';
import { PixelSvg, useArcadeFrame } from '../pixel/PixelArt';
import { useSettings } from '../theme/settings';
import { seatStyles } from '../theme/tokens';
import { BOARD_H, BOARD_W, edgePos, hexPos, vertexPos } from './layout';
import { buildingPlacement, PixelCursor, Placed, raiderPlacement, trailPlacement, cursorArt } from './Pieces';
import { CELL, LOOP, TOKEN_DY, groundFrame, raiderShade, rasterizeIsland, skyFrame } from './raster';

export type TargetKind = 'vertex' | 'edge' | 'hex';
export interface Targets {
  kind: TargetKind;
  ids: number[];
  /** Spoken label for each target, e.g. "Build outpost". */
  label: string;
}

export interface BoardState {
  board: Board;
  buildings: (Building | null)[];
  trails: (Seat | null)[];
  raiderHex: number;
}

export interface BoardHandle {
  /** Board coordinates → window coordinates (for flying cards). */
  toWindow: (p: { x: number; y: number }) => { x: number; y: number };
  hexCenter: (hex: number) => { x: number; y: number };
}

/** Static island art, rasterized once per board. */
const Island = memo(function Island({ board }: { board: Board }) {
  const paths = useMemo(() => rasterizeIsland(board), [board]);
  return <PixelSvg paths={paths} width={BOARD_W} height={BOARD_H} style={{ position: 'absolute', left: 0, top: 0 }} />;
});

const RaiderShade = memo(function RaiderShade({ hex }: { hex: number }) {
  const paths = useMemo(() => raiderShade(hex), [hex]);
  return <PixelSvg paths={paths} width={BOARD_W} height={BOARD_H} style={{ position: 'absolute', left: 0, top: 0 }} />;
});

/** Waves, gulls, sheep, wheat and kiln smoke — frames are composited once and cached. */
const Ground = memo(function Ground({ board, paused }: { board: Board; paused: boolean }) {
  const frame = useArcadeFrame(paused) % LOOP;
  const cache = useMemo(() => new Map<number, ColorPath[]>(), [board]);
  let paths = cache.get(frame);
  if (!paths) {
    paths = groundFrame(board, frame);
    cache.set(frame, paths);
  }
  return <PixelSvg paths={paths} width={BOARD_W} height={BOARD_H} style={{ position: 'absolute', left: 0, top: 0 }} />;
});

/** Chimney smoke and town pennants above the pieces. */
const Sky = memo(function Sky({ buildings, paused }: { buildings: (Building | null)[]; paused: boolean }) {
  const frame = useArcadeFrame(paused) % LOOP;
  const signature = buildings.map((b) => (b ? `${b.owner}${b.kind[0]}` : '')).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cache = useMemo(() => new Map<number, ColorPath[]>(), [signature]);
  let paths = cache.get(frame);
  if (!paths) {
    paths = skyFrame(buildings, seatStyles.map((s) => s.color), frame);
    cache.set(frame, paths);
  }
  return <PixelSvg paths={paths} width={BOARD_W} height={BOARD_H} style={{ position: 'absolute', left: 0, top: 0 }} />;
});

export const BoardView = forwardRef<
  BoardHandle,
  {
    state: BoardState;
    targets: Targets | null;
    onTarget: (id: number) => void;
    /** Keys of pieces that should animate in: `v12`, `e40`, `raider`. */
    fresh: Set<string>;
    /** Pieces not yet revealed by the "since you were last here" replay. */
    hidden?: Set<string>;
  }
>(function BoardView({ state, targets, onTarget, fresh, hidden }, ref) {
  const { theme, reduceMotion } = useSettings();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const origin = useRef({ x: 0, y: 0 });
  const container = useRef<View>(null);

  // Fit the island (not the whole ocean margin) to the available space.
  const fit = size.w ? Math.min(size.w / (BOARD_W - 24), size.h / (BOARD_H - 24)) : 0.5;
  const scale = useSharedValue(fit);
  const savedScale = useSharedValue(fit);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const minScale = useSharedValue(fit * 0.9);

  useEffect(() => {
    scale.value = fit;
    savedScale.value = fit;
    minScale.value = fit * 0.9;
    tx.value = 0;
    ty.value = 0;
  }, [fit, scale, savedScale, minScale, tx, ty]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
    container.current?.measureInWindow((x, y) => (origin.current = { x, y }));
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      toWindow: (p) => ({
        x: origin.current.x + size.w / 2 + (p.x - BOARD_W / 2) * scale.value + tx.value,
        y: origin.current.y + size.h / 2 + (p.y - BOARD_H / 2) * scale.value + ty.value,
      }),
      hexCenter: (hex) => hexPos[hex],
    }),
    [size, scale, tx, ty],
  );

  const clampT = (v: number, s: number, dim: number, boardDim: number) => {
    'worklet';
    const max = Math.max(0, (boardDim * s - dim) / 2) + dim * 0.25;
    return Math.min(max, Math.max(-max, v));
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onUpdate((e) => {
      const next = Math.min(minScale.value * 3.6, Math.max(minScale.value, savedScale.value * e.scale));
      const k = next / savedScale.value;
      const fx = e.focalX - size.w / 2;
      const fy = e.focalY - size.h / 2;
      scale.value = next;
      tx.value = clampT(fx - (fx - savedTx.value) * k, next, size.w, BOARD_W);
      ty.value = clampT(fy - (fy - savedTy.value) * k, next, size.h, BOARD_H);
    });

  const pan = Gesture.Pan()
    .minDistance(8)
    .averageTouches(true)
    .onStart(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = clampT(savedTx.value + e.translationX, scale.value, size.w, BOARD_W);
      ty.value = clampT(savedTy.value + e.translationY, scale.value, size.h, BOARD_H);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      const zoomedIn = scale.value > minScale.value / 0.9 * 1.3;
      const next = zoomedIn ? minScale.value / 0.9 : (minScale.value / 0.9) * 2;
      const fx = e.x - size.w / 2;
      const fy = e.y - size.h / 2;
      const spring = { damping: 18, stiffness: 160 };
      scale.value = withSpring(next, spring);
      tx.value = withSpring(zoomedIn ? 0 : clampT(-fx, next, size.w, BOARD_W), spring);
      ty.value = withSpring(zoomedIn ? 0 : clampT(-fy, next, size.h, BOARD_H), spring);
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);
  const boardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const topo = topology();

  return (
    <GestureDetector gesture={gesture}>
      <View
        ref={container}
        onLayout={onLayout}
        style={{ flex: 1, overflow: 'hidden', backgroundColor: theme.color.ocean }}
        accessibilityLabel="Island board. Pinch to zoom, drag to pan, double-tap to reset."
      >
        {size.w > 0 && (
          <Animated.View
            style={[
              { position: 'absolute', width: BOARD_W, height: BOARD_H, left: (size.w - BOARD_W) / 2, top: (size.h - BOARD_H) / 2 },
              boardStyle,
            ]}
          >
            <Island board={state.board} />
            {state.board.hexes[state.raiderHex].token !== null && <RaiderShade hex={state.raiderHex} />}
            <Ground board={state.board} paused={reduceMotion} />

            {state.trails.map((owner, e) =>
              owner === null || hidden?.has(`e${e}`) ? null : (
                <Placed key={`e${e}`} p={trailPlacement(e, owner)} animate={fresh.has(`e${e}`)} reduceMotion={reduceMotion} />
              ),
            )}
            {state.buildings.map((raw, v) => {
              // During the replay an unrevealed town shows as the outpost it was; an unrevealed outpost is absent.
              const veiled = hidden?.has(`v${v}`);
              const b = raw && veiled ? (raw.kind === 'town' ? { ...raw, kind: 'outpost' as const } : null) : raw;
              return !b ? null : (
                <Placed key={`v${v}-${b.kind}`} p={buildingPlacement(b.kind, b.owner, v)} animate={fresh.has(`v${v}`)} reduceMotion={reduceMotion} />
              );
            })}
            <Placed key={`raider-${state.raiderHex}`} p={raiderPlacement(state.raiderHex)} animate={fresh.has('raider')} reduceMotion={reduceMotion} bob />
            <Sky buildings={state.buildings} paused={reduceMotion} />

            {targets?.ids.map((id) => {
              const p = targets.kind === 'vertex' ? vertexPos[id] : targets.kind === 'edge' ? edgePos[id] : { x: hexPos[id].x, y: hexPos[id].y + TOKEN_DY * CELL };
              const hit = targets.kind === 'hex' ? 76 : targets.kind === 'vertex' ? 56 : 48;
              const desc =
                targets.kind === 'hex'
                  ? `${targets.label}: ${state.board.hexes[id].terrain}${state.board.hexes[id].token ? ` ${state.board.hexes[id].token}` : ''}`
                  : targets.kind === 'vertex'
                    ? `${targets.label}, touching ${topo.vertices[id].hexes.map((h) => state.board.hexes[h].terrain).join(', ')}`
                    : targets.label;
              return (
                <Pressable
                  key={`t${targets.kind}${id}`}
                  onPress={() => onTarget(id)}
                  accessibilityRole="button"
                  accessibilityLabel={desc}
                  style={{
                    position: 'absolute',
                    left: p.x - hit / 2,
                    top: p.y - hit / 2,
                    width: hit,
                    height: hit,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PixelCursor kind={targets.kind} color={theme.color.glow} reduceMotion={reduceMotion} />
                </Pressable>
              );
            })}
          </Animated.View>
        )}
      </View>
    </GestureDetector>
  );
});
