// Rasterizes the island into 16-bit pixel art on a fixed cell grid.
// Static art (tiles, beach, harbors, number discs, scenery) is built once per board;
// animated art (waves, sheep, wheat, smoke…) is composited per frame and cached.
import { PIPS, topology, type Board, type Building, type HarborKind, type Seat, type Terrain } from '@tideholm/engine';
import { PixelCanvas, bayer, hash2, type ColorPath } from '../pixel/canvas';
import { RESOURCE_PALETTE, RESOURCE_SPRITES } from '../pixel/icons';
import {
  BONE,
  BRICKS,
  CACTUS,
  CHIMNEY,
  CLAY_MOUND,
  CRAB,
  FENCE,
  FLAG,
  FLOWER_PINK,
  FLOWER_YELLOW,
  GULL,
  INK,
  KILN,
  MINE_CART,
  MOUNTAIN,
  MOUNTAIN_SMALL,
  MUSHROOM,
  PAL,
  PENNANT,
  PINE,
  PINE_SMALL,
  ROCK,
  SHEEP,
  SHEEP_GRAZE,
  SHELL,
  SPARKLE,
  TUFT,
  WAVE,
  WHEAT,
  drawBigText,
  drawTinyText,
} from '../pixel/sprites';
import { BOARD_H, BOARD_W, CENTER, HEX, edgePos, hexPos, outward, vertexPos } from './layout';

/** Board units per pixel cell. */
export const CELL = 3;
export const GRID_W = Math.ceil(BOARD_W / CELL);
export const GRID_H = Math.ceil(BOARD_H / CELL);
/** Animation loop length in frames (16 s at 6 fps); every motion period divides it. */
export const LOOP = 96;

const SQ3 = Math.sqrt(3);
const APOTHEM = (HEX * SQ3) / 2;

interface TerrainPal {
  base: string;
  hi: string;
  lo: string;
  a: string;
  b: string;
}

const TERRAIN: Record<Terrain, TerrainPal> = {
  grove: { base: '#3C8A50', hi: '#62B36E', lo: '#22573A', a: '#317A47', b: '#4C9A5C' },
  meadow: { base: '#8FCF60', hi: '#B9E687', lo: '#62A040', a: '#A3DB70', b: '#7DBE52' },
  fields: { base: '#EAC14B', hi: '#F9DE7E', lo: '#B88C22', a: '#D4A93A', b: '#F2CF62' },
  crags: { base: '#8C95A8', hi: '#B8BFCD', lo: '#596175', a: '#7A8396', b: '#9EA6B6' },
  claypit: { base: '#C66A3D', hi: '#E59466', lo: '#8A4322', a: '#B55C33', b: '#D47A4B' },
  dunes: { base: '#E7D3A1', hi: '#F8EBC8', lo: '#BFA36A', a: '#D4BC84', b: '#EFDFB4' },
};

const SAND = '#F3E2B3';
const SAND_WET = '#DCC58F';
const FOAM = '#F2FFFC';
const SHALLOW = '#5FD0C4';
const SHALLOW_DEEP = '#3DBAB3';

/** Metric to the nearest edge of a pointy-top hex, plus that edge's outward normal. */
function hexMetric(dx: number, dy: number) {
  const a0 = dx;
  const a1 = dx * 0.5 + dy * (SQ3 / 2);
  const a2 = dx * 0.5 - dy * (SQ3 / 2);
  const m0 = Math.abs(a0);
  const m1 = Math.abs(a1);
  const m2 = Math.abs(a2);
  if (m0 >= m1 && m0 >= m2) return { d: m0, nx: Math.sign(a0), ny: 0 };
  if (m1 >= m2) return { d: m1, nx: 0.5 * Math.sign(a1), ny: (SQ3 / 2) * Math.sign(a1) };
  return { d: m2, nx: 0.5 * Math.sign(a2), ny: -(SQ3 / 2) * Math.sign(a2) };
}

const topo = topology();
const axialToHex = new Map(topo.hexes.map((h) => [`${h.q},${h.r}`, h.id]));

function hexAt(px: number, py: number): number | null {
  const x = px - CENTER.x;
  const y = py - CENTER.y;
  const fq = ((SQ3 / 3) * x - y / 3) / HEX;
  const fr = ((2 / 3) * y) / HEX;
  const fs = -fq - fr;
  let q = Math.round(fq);
  let r = Math.round(fr);
  const s = Math.round(fs);
  const dq = Math.abs(q - fq);
  const dr = Math.abs(r - fr);
  const ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return axialToHex.get(`${q},${r}`) ?? null;
}

/** Distance (board units) outside the island; ≤ 0 means on a tile. */
function outsideDist(px: number, py: number): number {
  let best = Infinity;
  for (const h of hexPos) {
    const m = hexMetric(px - h.x, py - h.y).d - APOTHEM;
    if (m < best) best = m;
  }
  return best;
}

/** Hex center in cells. */
export function hexCell(id: number) {
  return { x: Math.round(hexPos[id].x / CELL), y: Math.round(hexPos[id].y / CELL) };
}

export function vertexCell(v: number) {
  return { x: Math.round(vertexPos[v].x / CELL), y: Math.round(vertexPos[v].y / CELL) };
}

/** Number token disc center (cells), relative to the hex center. */
export const TOKEN_DY = 1;

// --- Static island -------------------------------------------------------------

function terrainCell(t: Terrain, i: number, j: number, lx: number, ly: number): string {
  const p = TERRAIN[t];
  const n = hash2(i, j, 7);
  switch (t) {
    case 'fields': {
      // Ploughed rows that follow a gentle slope.
      const row = (j + Math.floor(i / 3)) % 4;
      if (row === 0) return p.a;
      return n < 0.06 ? p.b : p.base;
    }
    case 'dunes': {
      const ripple = (j + Math.round(1.6 * Math.sin(i * 0.45))) % 6;
      if (ripple === 0) return p.a;
      if (ripple === 1 && n < 0.5) return p.b;
      return p.base;
    }
    case 'claypit':
      if (j % 5 === 0 && hash2(Math.floor(i / 4), j, 3) < 0.55) return p.a;
      return n < 0.07 ? p.b : p.base;
    case 'meadow':
      if (n < 0.05) return p.a;
      if (n < 0.09) return p.b;
      return p.base;
    case 'grove':
      if (n < 0.1) return p.a;
      if (n < 0.14) return p.b;
      return p.base;
    case 'crags':
      if (n < 0.09) return p.a;
      if (n < 0.15) return p.b;
      if ((i + j * 2) % 9 === 0 && hash2(i, j, 11) < 0.5) return p.lo;
      return p.base;
  }
  void lx;
  void ly;
}

function drawTerrainBase(cv: PixelCanvas, board: Board): void {
  const L = { x: -0.6, y: -0.8 };
  for (let j = 0; j < GRID_H; j++) {
    for (let i = 0; i < GRID_W; i++) {
      const px = (i + 0.5) * CELL;
      const py = (j + 0.5) * CELL;
      const hex = hexAt(px, py);
      if (hex !== null) {
        const h = hexPos[hex];
        const m = hexMetric(px - h.x, py - h.y);
        const edge = APOTHEM - m.d;
        const terrain = board.hexes[hex].terrain;
        const pal = TERRAIN[terrain];
        if (edge < CELL) {
          cv.set(i, j, INK);
          continue;
        }
        const facing = m.nx * L.x + m.ny * L.y;
        if (edge < CELL * 2 && facing > 0.2) {
          cv.set(i, j, pal.hi);
          continue;
        }
        if (edge < CELL * 3 && facing < -0.2) {
          cv.set(i, j, edge < CELL * 2 ? pal.lo : bayer(i, j) < 0.5 ? pal.lo : pal.base);
          continue;
        }
        cv.set(i, j, terrainCell(terrain, i, j, px - h.x, py - h.y));
        continue;
      }
      const out = outsideDist(px, py);
      const c = out / CELL;
      if (c < 3) cv.set(i, j, hash2(i, j, 5) < 0.08 ? '#FFF4D6' : SAND);
      else if (c < 4) cv.set(i, j, SAND_WET);
      else if (c < 5) cv.set(i, j, FOAM);
      else if (c < 8) cv.set(i, j, c < 6 ? SHALLOW : bayer(i, j) < (c - 6) / 2 ? SHALLOW_DEEP : SHALLOW);
      else if (c < 10 && bayer(i, j) < (10 - c) / 2) cv.set(i, j, SHALLOW_DEEP);
    }
  }
}

function drawToken(cv: PixelCanvas, cx: number, cy: number, token: number): void {
  const R = 7.4;
  const disc = (oy: number, rim: string, face: string) => {
    for (let y = -8; y <= 8; y++) {
      for (let x = -8; x <= 8; x++) {
        const d = Math.hypot(x, y);
        if (d <= R) cv.set(cx + x, cy + oy + y, d > R - 1.1 ? rim : face);
      }
    }
  };
  disc(2, INK, '#BFA978');
  disc(0, INK, '#FFF6E0');
  // A little shine in the upper left.
  for (let y = -6; y <= -2; y++) for (let x = -6; x <= -2; x++) {
    const d = Math.hypot(x, y);
    if (d > 4.8 && d < 6.1 && x + y < -6) cv.set(cx + x, cy + y, '#FFFFFF');
  }
  const red = token === 6 || token === 8;
  const color = red ? '#E2325C' : INK;
  drawBigText(cv, String(token), cx, cy - 4, color);
  const pips = PIPS[token] ?? 0;
  for (let k = 0; k < pips; k++) cv.set(cx - (pips - 1) + k * 2, cy + 4, color);
}

function drawHarbor(cv: PixelCanvas, edge: number, kind: HarborKind): void {
  const m = edgePos[edge];
  const o = outward(m);
  const bx = Math.round((m.x + o.x * 44) / CELL);
  const by = Math.round((m.y + o.y * 44) / CELL);
  // Piers from both coastal corners out to the sign.
  for (const v of topo.edges[edge].vertices) {
    const a = vertexCell(v);
    const steps = Math.max(Math.abs(bx - a.x), Math.abs(by - a.y));
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(a.x + ((bx - a.x) * s) / steps);
      const y = Math.round(a.y + ((by - a.y) * s) / steps);
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (!cv.get(x + ox, y + oy) || cv.get(x + ox, y + oy) === SHALLOW || cv.get(x + ox, y + oy) === SHALLOW_DEEP || cv.get(x + ox, y + oy) === FOAM) cv.set(x + ox, y + oy, INK);
      cv.set(x, y, s % 2 ? '#C99560' : '#A0703C');
    }
  }
  if (kind === 'any') {
    cv.box(bx - 8, by - 5, 17, 11, '#FFF6E0', INK);
    cv.rect(bx - 7, by + 5, 15, 1, '#BFA978');
    drawTinyText(cv, '3:1', bx, by - 2, INK);
  } else {
    cv.box(bx - 8, by - 9, 17, 19, '#FFF6E0', INK);
    cv.rect(bx - 7, by + 9, 15, 1, '#BFA978');
    const spr = RESOURCE_SPRITES[kind];
    cv.sprite(spr, bx - 6, by - 7, RESOURCE_PALETTE);
    drawTinyText(cv, '2:1', bx, by + 3, INK);
  }
}

/** Scenery per terrain, placed around the number disc. Offsets are cells from hex center. */
function drawScenery(cv: PixelCanvas, t: Terrain, cx: number, cy: number, seed: number): void {
  const flip = hash2(seed, 1) < 0.5;
  switch (t) {
    case 'grove':
      cv.spriteAt(PINE, cx - 8, cy - 7, PAL);
      cv.spriteAt(PINE, cx + 8, cy - 7, PAL);
      cv.spriteAt(PINE, cx, cy - 9, PAL);
      cv.spriteAt(PINE_SMALL, cx - 12, cy + 4, PAL);
      cv.spriteAt(PINE_SMALL, cx + 12, cy + 4, PAL);
      cv.spriteAt(PINE_SMALL, cx - 5, cy + 15, PAL);
      cv.spriteAt(MUSHROOM, cx + 5, cy + 14, PAL);
      break;
    case 'meadow':
      cv.spriteAt(FENCE, cx - 12, cy + 4, PAL);
      cv.spriteAt(FENCE, cx + 12, cy + 4, PAL, true);
      cv.spriteAt(TUFT, cx - 11, cy - 11, PAL);
      cv.spriteAt(TUFT, cx + 10, cy - 12, PAL);
      cv.spriteAt(FLOWER_PINK, cx - 7, cy + 13, PAL);
      cv.spriteAt(FLOWER_YELLOW, cx + 7, cy + 12, PAL);
      cv.spriteAt(FLOWER_YELLOW, cx - 13, cy - 3, PAL);
      cv.spriteAt(FLOWER_PINK, cx + 13, cy - 3, PAL);
      break;
    case 'fields':
      // Animated wheat fills the top and bottom bands; a scarecrow-ish post on the side.
      cv.rect(cx - 14, cy + 1, 1, 4, '#8B5A2B');
      cv.rect(cx - 15, cy + 2, 3, 1, '#8B5A2B');
      cv.set(cx - 14, cy, '#E2B43B');
      break;
    case 'crags':
      cv.spriteAt(MOUNTAIN, cx - 3, cy - 8, PAL, flip);
      cv.spriteAt(MOUNTAIN_SMALL, cx + 9, cy - 8, PAL);
      cv.spriteAt(ROCK, cx - 12, cy + 4, PAL);
      cv.spriteAt(MINE_CART, cx + 1, cy + 15, PAL);
      cv.spriteAt(ROCK, cx + 12, cy + 5, PAL);
      break;
    case 'claypit':
      cv.spriteAt(CLAY_MOUND, cx - 6, cy - 8, PAL);
      cv.spriteAt(KILN, cx + 8, cy - 8, PAL);
      cv.spriteAt(BRICKS, cx, cy + 15, PAL);
      cv.spriteAt(CLAY_MOUND, cx + 12, cy + 5, PAL);
      break;
    case 'dunes':
      cv.spriteAt(CACTUS, cx - 8, cy - 5, PAL);
      cv.spriteAt(CACTUS, cx + 11, cy + 4, PAL, true);
      cv.spriteAt(SHELL, cx + 6, cy - 10, PAL);
      cv.spriteAt(BONE, cx - 11, cy + 5, PAL);
      break;
  }
}

/** Builds the static island art: tiles, beach, harbors, scenery and number discs. */
export function rasterizeIsland(board: Board): ColorPath[] {
  const cv = new PixelCanvas();
  drawTerrainBase(cv, board);
  for (const h of board.harbors) drawHarbor(cv, h.edge, h.kind);
  board.hexes.forEach((tile, id) => {
    const c = hexCell(id);
    drawScenery(cv, tile.terrain, c.x, c.y, id);
    if (tile.token !== null) drawToken(cv, c.x, c.y + TOKEN_DY, tile.token);
  });
  return cv.toPaths(CELL);
}

/** A translucent shadow over the number disc the Raider is sitting on (number stays readable). */
export function raiderShade(hex: number): ColorPath[] {
  const cv = new PixelCanvas();
  const c = hexCell(hex);
  for (let y = -7; y <= 7; y++) {
    for (let x = -7; x <= 7; x++) if (Math.hypot(x, y) <= 6.4) cv.set(c.x + x, c.y + TOKEN_DY + y, INK);
  }
  return cv.toPaths(CELL).map((p) => ({ ...p, opacity: 0.45 }));
}

// --- Animation ------------------------------------------------------------------

/** Ocean wave and sparkle spots, scattered deterministically in open water. */
const oceanSpots: { x: number; y: number; phase: number; sparkle: boolean }[] = (() => {
  const out: { x: number; y: number; phase: number; sparkle: boolean }[] = [];
  for (let gy = 4; gy < GRID_H - 4; gy += 13) {
    for (let gx = 4; gx < GRID_W - 6; gx += 17) {
      const x = gx + Math.floor(hash2(gx, gy, 1) * 9);
      const y = gy + Math.floor(hash2(gx, gy, 2) * 7);
      if (outsideDist(x * CELL, y * CELL) / CELL < 13) continue;
      out.push({ x, y, phase: Math.floor(hash2(gx, gy, 3) * LOOP), sparkle: hash2(gx, gy, 4) < 0.3 });
    }
  }
  return out;
})();

const DRIFT = [0, 1, 2, 1, 0, -1, -2, -1];

/** Puffs of smoke rising from (x, y), looping every 24 frames. */
function smoke(cv: PixelCanvas, x: number, y: number, frame: number, phase: number): void {
  for (let k = 0; k < 3; k++) {
    const age = (frame + phase + k * 8) % 24;
    if (age >= 21) continue;
    const py = y - Math.floor(age / 2.5);
    const px = x + [0, 0, 1, 1, 0, -1][Math.floor(age / 4) % 6];
    const light = age < 12 ? '#F4F4F6' : '#C9C9D3';
    if (age < 9) {
      cv.rect(px, py - 1, 2, 2, light);
      cv.set(px + 1, py, '#B8B8C6');
    } else {
      cv.set(px, py, light);
    }
  }
}

/** Ground-level animation for one frame: waves, gull, sheep, wheat, kiln smoke, crabs. */
export function groundFrame(board: Board, frame: number): ColorPath[] {
  const cv = new PixelCanvas();
  for (const s of oceanSpots) {
    const t = frame + s.phase;
    if (s.sparkle) {
      if (t % 32 < 3) cv.sprite(SPARKLE, s.x, s.y, PAL);
      continue;
    }
    cv.sprite(WAVE[(t >> 2) & 1], s.x + DRIFT[(t >> 3) % 8], s.y, PAL);
  }
  // A gull crossing the sky once per loop.
  const gx = Math.round(-12 + (frame / LOOP) * (GRID_W + 24));
  cv.sprite(GULL[(frame >> 1) & 1], gx, 10 + DRIFT[(frame >> 2) % 8], PAL);

  board.hexes.forEach((tile, id) => {
    const { x: cx, y: cy } = hexCell(id);
    const phase = id * 7;
    switch (tile.terrain) {
      case 'meadow': {
        // A walker pacing the top of the pasture (12 cells, 1 cell per 2 frames)…
        const t = (frame + phase) % 48;
        const pos = t < 24 ? Math.floor(t / 2) : 12 - Math.floor((t - 24) / 2);
        const left = t >= 24;
        cv.spriteAt(SHEEP[(t >> 1) & 1], cx - 6 + pos, cy - 8, PAL, left);
        // …and a grazer at the bottom that lifts its head now and then.
        const g = (frame + phase) % 24;
        cv.spriteAt(g < 16 ? SHEEP_GRAZE : SHEEP[0], cx, cy + 16, PAL, id % 2 === 0);
        break;
      }
      case 'fields': {
        const stalks = [
          [-8, -8],
          [-4, -9],
          [0, -9],
          [4, -9],
          [8, -8],
          [-4, 15],
          [0, 15],
          [4, 15],
          [-11, 9],
          [11, 9],
        ];
        stalks.forEach(([dx, by], k) => {
          // A gust rolls across the field from left to right.
          const s = (frame + phase - (dx + 12) / 2) % 24;
          const lean = s < 0 ? 0 : s < 4 ? 1 : s >= 12 && s < 14 ? 2 : 0;
          cv.spriteAt(WHEAT[lean], cx + dx, cy + by, PAL);
          void k;
        });
        break;
      }
      case 'claypit':
        smoke(cv, cx + 8, cy - 16, frame, phase);
        break;
      case 'dunes': {
        const t = (frame + phase) % 32;
        const pos = t < 16 ? Math.floor(t / 2) : 8 - Math.floor((t - 16) / 2);
        cv.spriteAt(CRAB[(t >> 1) & 1], cx - 4 + pos, cy + 15, PAL);
        break;
      }
    }
  });
  return cv.toPaths(CELL);
}

// --- Pieces -------------------------------------------------------------------------

/** Top-left cell where a piece's canvas is anchored for a vertex. */
export function pieceOrigin(kind: 'outpost' | 'town', v: number) {
  const c = vertexCell(v);
  return kind === 'outpost' ? { x: c.x - 7, y: c.y - 11 } : { x: c.x - 9, y: c.y - 15 };
}

/** Sky-level animation: chimney smoke and town pennants. Depends on buildings. */
export function skyFrame(buildings: (Building | null)[], roofColors: string[], frame: number): ColorPath[] {
  const cv = new PixelCanvas();
  buildings.forEach((b, v) => {
    if (!b) return;
    const o = pieceOrigin(b.kind, v);
    const ch = CHIMNEY[b.kind];
    smoke(cv, o.x + ch.x, o.y + ch.y, frame, v * 5);
    if (b.kind === 'town') {
      cv.sprite(FLAG[((frame + v) >> 1) & 1], o.x + PENNANT.x, o.y + PENNANT.y, { ...PAL, m: roofColors[b.owner] ?? PAL.m });
    }
  });
  return cv.toPaths(CELL);
}

export type { Seat };
