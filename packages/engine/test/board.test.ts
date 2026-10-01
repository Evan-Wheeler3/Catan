import { describe, expect, it } from 'vitest';
import { createRng, generateBoard, redTokensSeparated, topology, TOKEN_POOL } from '../src/index.ts';

describe('topology', () => {
  const topo = topology();

  it('has the standard island dimensions', () => {
    expect(topo.hexes).toHaveLength(19);
    expect(topo.vertices).toHaveLength(54);
    expect(topo.edges).toHaveLength(72);
    expect(topo.coast).toHaveLength(30);
  });

  it('links hexes, vertices and edges consistently', () => {
    for (const h of topo.hexes) {
      expect(new Set(h.vertices).size).toBe(6);
      expect(new Set(h.edges).size).toBe(6);
      for (const v of h.vertices) expect(topo.vertices[v].hexes).toContain(h.id);
    }
    for (const v of topo.vertices) {
      expect(v.hexes.length).toBeGreaterThanOrEqual(1);
      expect(v.hexes.length).toBeLessThanOrEqual(3);
      expect([2, 3]).toContain(v.neighbors.length);
      expect(v.edges).toHaveLength(v.neighbors.length);
    }
    const center = topo.hexes.find((h) => h.q === 0 && h.r === 0)!;
    expect(center.neighbors).toHaveLength(6);
  });

  it('orders the coast as a closed loop', () => {
    for (let i = 0; i < topo.coast.length; i++) {
      const a = topo.edges[topo.coast[i]].vertices;
      const b = topo.edges[topo.coast[(i + 1) % topo.coast.length]].vertices;
      expect(a.some((v) => b.includes(v))).toBe(true);
    }
  });
});

describe('generateBoard', () => {
  it('uses the full terrain and token pools', () => {
    const board = generateBoard(createRng(7));
    const terrains = board.hexes.map((h) => h.terrain);
    expect(terrains.filter((t) => t === 'dunes')).toHaveLength(1);
    expect(terrains.filter((t) => t === 'grove')).toHaveLength(4);
    expect(terrains.filter((t) => t === 'crags')).toHaveLength(3);
    const tokens = board.hexes.map((h) => h.token).filter((t) => t !== null).sort((a, b) => a! - b!);
    expect(tokens).toEqual([...TOKEN_POOL].sort((a, b) => a - b));
    expect(board.hexes.find((h) => h.terrain === 'dunes')!.token).toBeNull();
  });

  it('never puts 6s and 8s next to each other', () => {
    for (let seed = 1; seed <= 300; seed++) {
      expect(redTokensSeparated(generateBoard(createRng(seed)).hexes)).toBe(true);
    }
  });

  it('places nine harbors on distinct, non-touching coastal edges', () => {
    const topo = topology();
    for (let seed = 1; seed <= 50; seed++) {
      const board = generateBoard(createRng(seed));
      expect(board.harbors).toHaveLength(9);
      expect(board.harbors.filter((h) => h.kind === 'any')).toHaveLength(4);
      const vertices = board.harbors.flatMap((h) => topo.edges[h.edge].vertices);
      expect(new Set(vertices).size).toBe(18);
      for (const h of board.harbors) expect(topo.coast).toContain(h.edge);
    }
  });

  it('is deterministic for a seed', () => {
    expect(generateBoard(createRng(99))).toEqual(generateBoard(createRng(99)));
    expect(generateBoard(createRng(99))).not.toEqual(generateBoard(createRng(100)));
  });
});
