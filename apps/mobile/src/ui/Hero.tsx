// The Tideholm hero: a pixel island with a cottage, pines and a lazy sun.
import { PixelIcon } from '../pixel/PixelArt';
import { heroArt } from '../pixel/scenes';

export function HeroIsland({ size = 220 }: { size?: number }) {
  return <PixelIcon art={heroArt()} size={size} box={56} />;
}
