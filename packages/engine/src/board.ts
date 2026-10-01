import { HARBOR_GAPS, HARBOR_POOL, TERRAIN_POOL, TOKEN_POOL } from './constants.ts';
import { topology } from './geometry.ts';
import type { Rng } from './rng.ts';
import { shuffle } from './rng.ts';
import type { Board, Harbor, HexTile } from './types.ts';

const isRed = (t: number | null) => t === 6 || t === 8;

/** True if no two adjacent hexes both carry a 6 or an 8. */
export function redTokensSeparated(hexes: HexTile[]): boolean {
  const topo = topology();
  return topo.hexes.every((h) => !isRed(hexes[h.id].token) || h.neighbors.every((n) => !isRed(hexes[n].token)));
}

/**
 * Generates a random board: shuffled terrains, number tokens with no adjacent 6/8,
 * and nine harbors spread evenly around the coast.
 */
export function generateBoard(rng: Rng): Board {
  const topo = topology();
  let hexes: HexTile[] = [];

  // Rejection sampling converges quickly (~1 in 4 layouts is valid). A deterministic
  // repair pass follows as a safety net so this can never loop forever.
  for (let attempt = 0; attempt < 500; attempt++) {
    hexes = layout(rng);
    if (redTokensSeparated(hexes)) break;
  }
  if (!redTokensSeparated(hexes)) repairRedTokens(hexes);

  const harborKinds = shuffle(rng, HARBOR_POOL);
  const offset = rng.int(topo.coast.length);
  const harbors: Harbor[] = [];
  let pos = offset;
  for (let i = 0; i < HARBOR_GAPS.length; i++) {
    harbors.push({ edge: topo.coast[pos % topo.coast.length], kind: harborKinds[i] });
    pos += HARBOR_GAPS[i];
  }

  return { hexes, harbors };
}

function layout(rng: Rng): HexTile[] {
  const terrains = shuffle(rng, TERRAIN_POOL);
  const tokens = shuffle(rng, TOKEN_POOL);
  let t = 0;
  return terrains.map((terrain) => ({ terrain, token: terrain === 'dunes' ? null : tokens[t++] }));
}

/** Swap red tokens onto hexes that keep them apart. Only used if sampling failed. */
function repairRedTokens(hexes: HexTile[]): void {
  const topo = topology();
  for (let guard = 0; guard < 100 && !redTokensSeparated(hexes); guard++) {
    const bad = topo.hexes.find((h) => isRed(hexes[h.id].token) && h.neighbors.some((n) => isRed(hexes[n].token)))!;
    const target = topo.hexes.find(
      (h) =>
        hexes[h.id].token !== null &&
        !isRed(hexes[h.id].token) &&
        h.neighbors.every((n) => n === bad.id || !isRed(hexes[n].token)),
    );
    if (!target) break;
    const tmp = hexes[bad.id].token;
    hexes[bad.id].token = hexes[target.id].token;
    hexes[target.id].token = tmp;
  }
}
