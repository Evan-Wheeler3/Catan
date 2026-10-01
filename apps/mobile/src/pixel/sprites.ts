// Hand-drawn 16-bit style sprites. One character = one cell; '.' is transparent.
// Every sprite has an ink outline (K) so it stays readable on any terrain.
import { PixelCanvas, type Palette, type Sprite } from './canvas';

export const INK = '#2A1F3D';

/** Shared palette for board art. */
export const PAL: Palette = {
  K: INK,
  W: '#FFFFFF',
  w: '#D9DEE6',
  E: '#3B2D52',
  G: '#6CC070',
  g: '#2F7D4F',
  d: '#1F5C39',
  b: '#8B5A2B',
  B: '#5E3A1A',
  S: '#FFFFFF',
  s: '#A4ACBD',
  t: '#7F889B',
  T: '#5E6678',
  r: '#E08A5C',
  R: '#B5532C',
  c: '#C66A3D',
  Y: '#FFF1A6',
  y: '#E2B43B',
  o: '#7E5C10',
  C: '#F7EBC8',
  h: '#EF476F',
  m: '#FFB627',
  n: '#58A85A',
  N: '#2E6B35',
  p: '#FF9EC4',
  F: '#E9FFFB',
  f: '#9BE5DC',
  a: '#FF8A3D',
  q: '#F7B48C',
  l: '#D3D8E3',
  D: '#55607A',
  u: '#A97C10',
};

// --- Terrain decorations ------------------------------------------------------

export const PINE: Sprite = [
  '...K...',
  '..KGK..',
  '..KgK..',
  '.KGggK.',
  '.KggdK.',
  'KGgggdK',
  'KggggdK',
  '.KKbKK.',
  '..KbK..',
  '..KKK..',
];

export const PINE_SMALL: Sprite = [
  '..K..',
  '.KGK.',
  '.KgK.',
  'KGgdK',
  'KggdK',
  '.KbK.',
  '.KKK.',
];

export const MUSHROOM: Sprite = ['.KKK.', 'KhWhK', 'KKKKK', '.KCK.', '.KKK.'];

export const MOUNTAIN: Sprite = [
  '......K......',
  '.....KSK.....',
  '....KSSDK....',
  '...KSlSDDK...',
  '..KlllDDDDK..',
  '.KllllDDDDDK.',
  'KlllllDDDDDDK',
  'KKKKKKKKKKKKK',
];

export const MOUNTAIN_SMALL: Sprite = [
  '....K....',
  '...KSK...',
  '..KSlDK..',
  '.KllDDDK.',
  'KlllDDDDK',
  'KKKKKKKKK',
];

export const ROCK: Sprite = ['.KKK.', 'KsstK', 'KttTK', 'KKKKK'];

export const MINE_CART: Sprite = ['K.....K', 'KtSttsK', 'KTTTTTK', '.KK.KK.'];

export const BRICKS: Sprite = ['.KKKKKKK.', '.KrrKrrK.', 'KKKKKKKKK', 'KrrRKrrRK', 'KKKKKKKKK'];

export const CLAY_MOUND: Sprite = ['...KKKKK...', '..KqqrrrK..', '.KqrrrrrRK.', 'KrrrrrrRRRK', 'KKKKKKKKKKK'];

export const KILN: Sprite = ['..KKK..', '..KtK..', '.KKKKK.', 'KcccccK', 'KcKKKcK', 'KcKmKcK', 'KcKhKcK', 'KKKKKKK'];

export const CACTUS: Sprite = [
  '...K...',
  '..KnK..',
  'K.KnK..',
  'KnKnK.K',
  'KnnnKnK',
  '.KKnnnK',
  '..KnKK.',
  '..KNK..',
  '..KKK..',
];

export const SHELL: Sprite = ['.KK.', 'KpWK', 'KKKK'];
export const BONE: Sprite = ['K...K', 'KWWWK', 'K...K'];

export const TUFT: Sprite = ['N.N.N', '.NnN.'];
export const FLOWER_PINK: Sprite = ['.p.', 'pYp', '.N.'];
export const FLOWER_YELLOW: Sprite = ['.Y.', 'YmY', '.N.'];
export const FENCE: Sprite = ['K.K.K', 'bKbKb', 'KbKbK', 'b.b.b'];

// --- Animated critters & plants ----------------------------------------------

const SHEEP_BODY: Sprite = [
  '..KKKK....',
  '.KWWWWKKK.',
  'KWWwWWKEEK',
  'KWwWWwKEWK',
  'KWWWWWKEEK',
  '.KKKKKKKK.',
];
export const SHEEP: Sprite[] = [
  [...SHEEP_BODY, '.K.K..K.K.'],
  [...SHEEP_BODY, '..K.K..K.K'],
];
/** Grazing: head lowered. */
export const SHEEP_GRAZE: Sprite = [
  '..KKKK....',
  '.KWWWWKK..',
  'KWWwWWWWK.',
  'KWwWWwWKKK',
  'KWWWWWKEEK',
  '.KKKKKKEWK',
  '.K.K..KKK.',
];

export const WHEAT: Sprite[] = [
  ['..u..', '.uYu.', '.uYu.', '.uYu.', '..u..', '..o..', '..o..', '..o..'],
  ['...u.', '..uYu', '..uYu', '.uYu.', '..u..', '..o..', '..o..', '..o..'],
  ['.u...', 'uYu..', 'uYu..', '.uYu.', '..u..', '..o..', '..o..', '..o..'],
];

export const WAVE: Sprite[] = [
  ['..FF...', '.F..F.f', 'f....f.'],
  ['...FF..', 'f.F..F.', '.f....f'],
];

export const SPARKLE: Sprite = ['.F.', 'FFF', '.F.'];

export const GULL: Sprite[] = [
  ['K.......K', '.K.....K.', '..KWWWK..', '....K....'],
  ['.........', 'KKK...KKK', '...KWK...', '....K....'],
];

export const CRAB: Sprite[] = [
  ['K.....K', 'hK...Kh', '.KhhhK.', 'K.K.K.K'],
  ['.K...K.', 'Kh...hK', '.KhhhK.', '.K.K.K.'],
];

export const RAIDER: Sprite = [
  '...KKKK...',
  '..KhhhhK..',
  '.KhhhhhhKK',
  '.KEEEEEEKh',
  '.KEWEEWEK.',
  '.KEEEEEEK.',
  '..KEEEEK..',
  '.KEEhhEEK.',
  'KEEEEEEEEK',
  'KEEEEEEEEK',
  'KEEEhhEEEK',
  'KEEEEEEEEK',
  '.KKKKKKKK.',
];

// --- Bitmap fonts --------------------------------------------------------------

const DIGITS_5x7: Record<string, Sprite> = {
  '0': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  '1': ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
};

const TINY_3x5: Record<string, Sprite> = {
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  ':': ['.', '#', '.', '#', '.'],
};

/** Draws text in the bold 5×7 font (each lit cell doubled horizontally). Returns width. */
export function drawBigText(cv: PixelCanvas, text: string, cx: number, top: number, color: string): void {
  const glyphs = [...text].map((ch) => DIGITS_5x7[ch]);
  const widths = glyphs.map((g) => g[0].length + 1);
  const total = widths.reduce((a, b) => a + b, 0) + glyphs.length - 1;
  let x = Math.round(cx - total / 2);
  glyphs.forEach((g, gi) => {
    g.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        if (row[i] === '#') {
          cv.set(x + i, top + j, color);
          cv.set(x + i + 1, top + j, color);
        }
      }
    });
    x += widths[gi] + 1;
  });
}

export function drawTinyText(cv: PixelCanvas, text: string, cx: number, top: number, color: string): void {
  const glyphs = [...text].map((ch) => TINY_3x5[ch]);
  const total = glyphs.reduce((a, g) => a + g[0].length, 0) + glyphs.length - 1;
  let x = Math.round(cx - total / 2);
  for (const g of glyphs) {
    g.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] === '#') cv.set(x + i, top + j, color);
    });
    x += g[0].length + 1;
  }
}

// --- Seat pieces (generated so every seat gets its color, crest and roof pattern) ---

export interface SeatArt {
  roof: string;
  roofDark: string;
  mark: string;
  crest: 'circle' | 'triangle' | 'square' | 'diamond';
  pattern: 'solid' | 'stripes' | 'dots' | 'checks';
  /** Crest color on the walls: white on dark seats, ink on light ones. */
  crestInk?: string;
}

const CRESTS: Record<SeatArt['crest'], Sprite> = {
  circle: ['.###.', '#####', '#####', '#####', '.###.'],
  triangle: ['..#..', '..#..', '.###.', '.###.', '#####'],
  square: ['#####', '#####', '#####', '#####', '#####'],
  diamond: ['..#..', '.###.', '#####', '.###.', '..#..'],
};

export function crestSprite(crest: SeatArt['crest']): Sprite {
  return CRESTS[crest];
}

function roofColor(art: SeatArt, x: number, y: number): string {
  switch (art.pattern) {
    case 'stripes':
      return (x + y) % 3 === 0 ? art.mark : art.roofDark;
    case 'dots':
      return x % 2 === 0 && y % 2 === 0 ? art.mark : art.roofDark;
    case 'checks':
      return (x + y) % 2 === 0 ? art.mark : art.roofDark;
    default:
      return art.roofDark;
  }
}

function crest(cv: PixelCanvas, art: SeatArt, x: number, y: number): void {
  CRESTS[art.crest].forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === '#') cv.set(x + i, y + j, art.crestInk ?? INK);
  });
}

/** Outpost: a cottage with a chimney. 15×15 cells; chimney top at (11, 0). */
export function drawOutpost(cv: PixelCanvas, art: SeatArt): void {
  // Chimney
  cv.box(10, 0, 3, 6, PAL.t, INK);
  // Roof: a stepped triangle with a shaded right slope.
  for (let r = 0; r < 7; r++) {
    const y = 1 + r;
    const x0 = 6 - r;
    const x1 = 8 + r;
    for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1 || r === 0 || r === 6;
      cv.set(x, y, edge ? INK : x === x0 + 1 ? art.roof : roofColor(art, x, y));
    }
  }
  // Walls
  cv.box(1, 8, 13, 7, art.roof, INK);
  cv.rect(2, 13, 11, 1, art.roofDark);
  crest(cv, art, 3, 9);
  // Door
  cv.box(9, 10, 3, 5, PAL.b, INK);
  cv.set(10, 12, PAL.m);
}

/** Town: a two-storey hall with a tower and pennant. 19×20 cells; chimney top at (4, 2). */
export function drawTown(cv: PixelCanvas, art: SeatArt): void {
  // Tower with a pointed roof
  for (let r = 0; r < 4; r++) {
    const x0 = 14 - r;
    const x1 = 15 + r;
    for (let x = x0; x <= x1; x++) cv.set(x, r, x === x0 || x === x1 || r === 0 ? INK : roofColor(art, x, r));
  }
  cv.box(11, 3, 8, 17, art.roof, INK);
  cv.rect(17, 4, 1, 15, art.roofDark);
  cv.box(14, 7, 2, 3, '#7BC6FF', INK);
  cv.box(14, 12, 2, 3, '#7BC6FF', INK);
  // Pennant pole (the flag itself is animated in the sky layer)
  cv.rect(15, -4, 1, 4, INK);
  // Hall
  cv.box(3, 1, 3, 5, PAL.t, INK); // chimney
  for (let r = 0; r < 6; r++) {
    const half = r + 2;
    for (let i = -half; i <= half; i++) {
      const x = 7 + i;
      const y = 4 + r;
      if (x > 11) continue;
      cv.set(x, y, Math.abs(i) === half || r === 5 || r === 0 ? INK : roofColor(art, x, y));
    }
  }
  cv.box(0, 10, 12, 10, art.roof, INK);
  cv.rect(1, 18, 10, 1, art.roofDark);
  crest(cv, art, 2, 12);
  cv.box(8, 14, 3, 6, PAL.b, INK);
  cv.box(8, 11, 3, 2, '#7BC6FF', INK);
}

/** Cell offsets (from the piece's top-left) where smoke leaves the chimney. */
export const CHIMNEY = { outpost: { x: 11, y: -1 }, town: { x: 4, y: 0 } } as const;
/** Top of the town's pennant pole, relative to the town's origin. */
export const PENNANT = { x: 16, y: -4 } as const;

export const FLAG: Sprite[] = [
  ['mmmm.', 'mmmmm', 'mmm..'],
  ['mmm..', 'mmmmm', 'mmmm.'],
];
