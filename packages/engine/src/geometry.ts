// Static board topology for a radius-2 hex island (19 tiles, 54 vertices, 72 edges).
//
// We use pointy-top hexes on an integer lattice: a hex at axial (q, r) has its center at
// lattice (2q + r, 3r), and its six corners at offsets (0,-2) (1,-1) (1,1) (0,2) (-1,1)
// (-1,-1). One lattice unit is √3/2·size horizontally and size/2 vertically, so
// every vertex has exact integer coordinates and can be deduplicated by key.

export interface HexGeom {
  id: number;
  q: number;
  r: number;
  /** Lattice center. */
  x: number;
  y: number;
  /** Corner vertex ids, clockwise from top. */
  vertices: number[];
  /** Edge ids, clockwise from top-right. */
  edges: number[];
  /** Neighbouring hex ids. */
  neighbors: number[];
}

export interface VertexGeom {
  id: number;
  x: number;
  y: number;
  hexes: number[];
  edges: number[];
  neighbors: number[];
}

export interface EdgeGeom {
  id: number;
  /** [a, b] vertex ids with a < b. */
  vertices: [number, number];
  hexes: number[];
  /** Lattice midpoint. */
  x: number;
  y: number;
}

export interface Topology {
  hexes: HexGeom[];
  vertices: VertexGeom[];
  edges: EdgeGeom[];
  /** Coastal edges (touching exactly one hex), ordered clockwise around the island. */
  coast: number[];
}

const CORNERS: [number, number][] = [
  [0, -2],
  [1, -1],
  [1, 1],
  [0, 2],
  [-1, 1],
  [-1, -1],
];

export const BOARD_RADIUS = 2;

function build(radius: number): Topology {
  const axial: { q: number; r: number }[] = [];
  for (let r = -radius; r <= radius; r++) {
    for (let q = Math.max(-radius, -r - radius); q <= Math.min(radius, -r + radius); q++) {
      axial.push({ q, r });
    }
  }

  // Collect unique vertices.
  const vKey = (x: number, y: number) => `${x},${y}`;
  const vertexPoints = new Map<string, { x: number; y: number }>();
  for (const { q, r } of axial) {
    const cx = 2 * q + r;
    const cy = 3 * r;
    for (const [dx, dy] of CORNERS) vertexPoints.set(vKey(cx + dx, cy + dy), { x: cx + dx, y: cy + dy });
  }
  const sortedPoints = [...vertexPoints.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  const vertexId = new Map<string, number>();
  const vertices: VertexGeom[] = sortedPoints.map((p, id) => {
    vertexId.set(vKey(p.x, p.y), id);
    return { id, x: p.x, y: p.y, hexes: [], edges: [], neighbors: [] };
  });

  // Hexes with their corners; edges keyed by vertex pair.
  const edgePairs = new Map<string, [number, number]>();
  const hexCorners: number[][] = [];
  for (const { q, r } of axial) {
    const cx = 2 * q + r;
    const cy = 3 * r;
    const corners = CORNERS.map(([dx, dy]) => vertexId.get(vKey(cx + dx, cy + dy))!);
    hexCorners.push(corners);
    for (let i = 0; i < 6; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 6];
      const pair: [number, number] = a < b ? [a, b] : [b, a];
      edgePairs.set(`${pair[0]}-${pair[1]}`, pair);
    }
  }
  const sortedPairs = [...edgePairs.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const edgeId = new Map<string, number>();
  const edges: EdgeGeom[] = sortedPairs.map((pair, id) => {
    edgeId.set(`${pair[0]}-${pair[1]}`, id);
    const va = vertices[pair[0]];
    const vb = vertices[pair[1]];
    return { id, vertices: pair, hexes: [], x: (va.x + vb.x) / 2, y: (va.y + vb.y) / 2 };
  });

  const hexes: HexGeom[] = axial.map(({ q, r }, id) => {
    const corners = hexCorners[id];
    const hexEdges: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 6];
      hexEdges.push(edgeId.get(a < b ? `${a}-${b}` : `${b}-${a}`)!);
    }
    return { id, q, r, x: 2 * q + r, y: 3 * r, vertices: corners, edges: hexEdges, neighbors: [] };
  });

  for (const hex of hexes) {
    for (const v of hex.vertices) vertices[v].hexes.push(hex.id);
    for (const e of hex.edges) edges[e].hexes.push(hex.id);
  }
  for (const edge of edges) {
    const [a, b] = edge.vertices;
    vertices[a].edges.push(edge.id);
    vertices[b].edges.push(edge.id);
    vertices[a].neighbors.push(b);
    vertices[b].neighbors.push(a);
  }
  const hexByAxial = new Map(hexes.map((h) => [`${h.q},${h.r}`, h.id]));
  const dirs = [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ];
  for (const hex of hexes) {
    for (const [dq, dr] of dirs) {
      const n = hexByAxial.get(`${hex.q + dq},${hex.r + dr}`);
      if (n !== undefined) hex.neighbors.push(n);
    }
  }

  // Coast ordered clockwise by angle (screen coords: y down, so atan2 increasing = clockwise).
  // Convert lattice to roughly-isotropic space before measuring the angle.
  const angle = (e: EdgeGeom) => Math.atan2(e.y * 0.5, e.x * (Math.sqrt(3) / 2));
  const coast = edges
    .filter((e) => e.hexes.length === 1)
    .sort((a, b) => angle(a) - angle(b))
    .map((e) => e.id);

  return { hexes, vertices, edges, coast };
}

let cached: Topology | null = null;

/** The shared, immutable board topology. */
export function topology(): Topology {
  if (!cached) cached = build(BOARD_RADIUS);
  return cached;
}

/** Convert lattice coordinates to pixel coordinates for a hex of the given "size" (center→corner). */
export function latticeToPixel(x: number, y: number, size: number): { x: number; y: number } {
  return { x: x * (Math.sqrt(3) / 2) * size, y: y * (size / 2) };
}
