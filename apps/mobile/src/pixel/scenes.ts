// Small pixel illustrations for the sign-in hero and empty/error states.
import { canvasArt, PixelCanvas, type Art } from './canvas';
import { drawOutpost, INK, PAL, PINE, WAVE } from './sprites';

const SEA = '#1BA3A0';
const SEA_LIGHT = '#5FD0C4';

function sea(cv: PixelCanvas, y: number, w: number, h: number) {
  cv.rect(0, y, w, h, SEA);
  cv.rect(0, y, w, 1, SEA_LIGHT);
  for (let x = 2; x < w - 7; x += 11) cv.sprite(WAVE[(x / 11) & 1], x, y + 2 + ((x / 11) % 2), PAL);
}

function sun(cv: PixelCanvas, cx: number, cy: number) {
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
    const d = Math.hypot(x, y);
    if (d <= 4.2) cv.set(cx + x, cy + y, d > 3.2 ? INK : '#FFB627');
  }
  cv.rect(cx - 2, cy - 2, 2, 1, '#FFE27A');
}

let hero: Art | null = null;
export function heroArt(): Art {
  if (hero) return hero;
  const cv = new PixelCanvas();
  const W = 56;
  sun(cv, 50, 6);
  // Island mound: sand rim and grass top.
  for (let y = 0; y < 12; y++) {
    const half = Math.round(20 - (11 - y) * (11 - y) * 0.12);
    for (let x = -half; x <= half; x++) {
      const edge = Math.abs(x) >= half - 0 || y === 0;
      cv.set(28 + x, 18 + y, edge ? INK : y < 4 ? '#8FCF60' : y < 6 ? '#62A040' : '#F3E2B3');
    }
  }
  cv.spriteAt(PINE, 13, 19, PAL);
  cv.spriteAt(PINE, 18, 20, PAL);
  cv.spriteAt(PINE, 41, 20, PAL);
  const house = new PixelCanvas();
  drawOutpost(house, { roof: '#D55E00', roofDark: '#9E4400', mark: '#F59A55', crest: 'circle', pattern: 'solid' });
  house.bounds();
  const hb = house.bounds()!;
  for (let y = hb.y0; y <= hb.y1; y++) for (let x = hb.x0; x <= hb.x1; x++) cv.set(22 + x, 6 + y, house.get(x, y));
  cv.rect(33, 3, 2, 2, '#F4F4F6');
  cv.rect(34, 1, 1, 1, '#C9C9D3');
  cv.rect(35, -1, 1, 1, '#C9C9D3');
  sea(cv, 27, W, 6);
  hero = canvasArt(cv, 1);
  return hero;
}

const bottles = new Map<string, Art>();
export function bottleArt(tone: 'calm' | 'storm'): Art {
  let art = bottles.get(tone);
  if (art) return art;
  const cv = new PixelCanvas();
  const W = 44;
  if (tone === 'calm') sun(cv, 37, 6);
  else {
    // Storm cloud and a bolt.
    cv.box(28, 2, 14, 6, '#9AA3B5', INK);
    cv.box(31, 0, 7, 4, '#B8BFCD', INK);
    for (const [x, y] of [[34, 8], [33, 9], [32, 10], [33, 10], [34, 10], [33, 11], [32, 12]]) cv.set(x, y, '#EF476F');
  }
  // Bottle on its side: glass, cork, tiny island inside.
  const top = 12;
  for (let y = 0; y < 11; y++) {
    for (let x = 0; x < 26; x++) {
      const neck = x >= 21;
      const inside = neck ? y >= 3 && y <= 7 : true;
      if (!inside) continue;
      const edge = y === 0 || y === 10 || x === 0 || (neck && (y === 3 || y === 7)) || (x === 20 && (y < 3 || y > 7));
      cv.set(6 + x, top + y, edge ? INK : '#DDF6F1');
    }
  }
  cv.box(31, top + 3, 4, 5, '#B9783F', INK);
  cv.rect(8, top + 2, 10, 1, '#FFFFFF');
  for (let x = 0; x < 13; x++) cv.set(9 + x, top + 8, x < 2 || x > 10 ? '#DCC58F' : '#F3E2B3');
  for (let x = 2; x < 11; x++) cv.set(9 + x, top + 7, tone === 'calm' ? '#8FCF60' : '#8C95A8');
  cv.rect(15, top + 3, 1, 4, '#8B5A2B');
  cv.rect(13, top + 2, 5, 1, '#2F7D4F');
  cv.set(12, top + 3, '#2F7D4F');
  cv.set(18, top + 3, '#2F7D4F');
  sea(cv, top + 9, W, 7);
  art = canvasArt(cv, 1);
  bottles.set(tone, art);
  return art;
}
