// A tiny pixel compositor. Art is drawn into an integer cell grid, then flattened into one
// SVG path per color (horizontal runs merged), so even a whole animated layer renders as a
// handful of <Path> elements.

export type Sprite = readonly string[];
export type Palette = Record<string, string>;

export interface ColorPath {
  fill: string;
  d: string;
  opacity?: number;
}

const KEY_OFFSET = 4096;
const key = (x: number, y: number) => (y + KEY_OFFSET) * 8192 + (x + KEY_OFFSET);

export class PixelCanvas {
  private cells = new Map<number, string>();

  set(x: number, y: number, color: string | null | undefined): void {
    if (!color) return;
    this.cells.set(key(Math.round(x), Math.round(y)), color);
  }

  get(x: number, y: number): string | undefined {
    return this.cells.get(key(x, y));
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, color);
  }

  /** Filled rectangle with a 1-cell outline. */
  box(x: number, y: number, w: number, h: number, fill: string, outline: string): void {
    this.rect(x, y, w, h, outline);
    if (w > 2 && h > 2) this.rect(x + 1, y + 1, w - 2, h - 2, fill);
  }

  /**
   * Stamps a sprite. Characters map through the palette; '.' and ' ' are transparent.
   * `x, y` is the sprite's top-left cell; `flip` mirrors it horizontally.
   */
  sprite(s: Sprite, x: number, y: number, palette: Palette, flip = false): void {
    const w = Math.max(...s.map((r) => r.length));
    s.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        this.set(x + (flip ? w - 1 - i : i), y + j, palette[ch]);
      }
    });
  }

  /** Stamps a sprite centered horizontally on `cx` with its bottom row on `by`. */
  spriteAt(s: Sprite, cx: number, by: number, palette: Palette, flip = false): void {
    const w = Math.max(...s.map((r) => r.length));
    this.sprite(s, Math.round(cx - w / 2), Math.round(by - s.length + 1), palette, flip);
  }

  /** Inclusive cell bounds of everything drawn, or null if empty. */
  bounds(): { x0: number; y0: number; x1: number; y1: number } | null {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    this.cells.forEach((_c, k) => {
      const y = Math.floor(k / 8192) - KEY_OFFSET;
      const x = (k % 8192) - KEY_OFFSET;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    });
    return x0 === Infinity ? null : { x0, y0, x1, y1 };
  }

  merge(other: PixelCanvas): void {
    other.cells.forEach((c, k) => this.cells.set(k, c));
  }

  /**
   * Flattens to per-color paths in board units. `unit` is the cell size; a hair of overlap
   * hides anti-aliasing seams between neighbouring runs on native renderers.
   */
  toPaths(unit: number, originX = 0, originY = 0): ColorPath[] {
    const rows = new Map<number, number[]>();
    this.cells.forEach((_c, k) => {
      const y = Math.floor(k / 8192) - KEY_OFFSET;
      const x = (k % 8192) - KEY_OFFSET;
      let r = rows.get(y);
      if (!r) rows.set(y, (r = []));
      r.push(x);
    });
    const byColor = new Map<string, string[]>();
    const ov = 0.35;
    rows.forEach((xs, y) => {
      xs.sort((a, b) => a - b);
      let start = xs[0];
      let prev = xs[0];
      let color = this.get(start, y)!;
      const flush = (endX: number) => {
        const px = originX + start * unit;
        const py = originY + y * unit;
        const w = (endX - start + 1) * unit + ov;
        let arr = byColor.get(color);
        if (!arr) byColor.set(color, (arr = []));
        arr.push(`M${fmt(px)} ${fmt(py)}h${fmt(w)}v${fmt(unit + ov)}h${fmt(-w)}z`);
      };
      for (let i = 1; i < xs.length; i++) {
        const x = xs[i];
        const c = this.get(x, y)!;
        if (x === prev + 1 && c === color) {
          prev = x;
          continue;
        }
        flush(prev);
        start = prev = x;
        color = c;
      }
      flush(prev);
    });
    return [...byColor.entries()].map(([fill, parts]) => ({ fill, d: parts.join('') }));
  }
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** Small deterministic hash → [0, 1). Used for texture noise so boards render identically every time. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Ordered 2×2 Bayer dither threshold for (x, y). */
export function bayer(x: number, y: number): number {
  return [0, 0.5, 0.75, 0.25][((y & 1) << 1) | (x & 1)];
}

export interface Art {
  paths: ColorPath[];
  /** Size in cells. */
  w: number;
  h: number;
}

/** Normalizes a canvas so its art starts at (0, 0); `cell` is the cell size in output units. */
export function canvasArt(cv: PixelCanvas, cell: number): Art & { x0: number; y0: number } {
  const b = cv.bounds() ?? { x0: 0, y0: 0, x1: 0, y1: 0 };
  return { paths: cv.toPaths(cell, -b.x0 * cell, -b.y0 * cell), w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1, x0: b.x0, y0: b.y0 };
}
