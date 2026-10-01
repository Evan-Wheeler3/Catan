// Core types for the Tideholm rules engine.
// Everything here is plain JSON so states can be stored, cloned and diffed freely.

export const RESOURCES = ['timber', 'clay', 'fleece', 'grain', 'stone'] as const;
export type Resource = (typeof RESOURCES)[number];
export type ResourceCounts = Record<Resource, number>;

export type Terrain = 'grove' | 'claypit' | 'meadow' | 'fields' | 'crags' | 'dunes';

/** Seat index 0..playerCount-1. Seat order is turn order. */
export type Seat = number;

export type HarborKind = 'any' | Resource;

export type FortuneKind = 'warden' | 'trailblazer' | 'windfall' | 'embargo' | 'relic';

export interface FortuneCard {
  /** Unique id within a game, so the UI can key cards and the server can track them. */
  id: number;
  kind: FortuneKind;
  /** Turn number on which it was bought. Cards can't be played the turn they're bought. */
  boughtOnTurn: number;
}

export interface HexTile {
  terrain: Terrain;
  /** Number token 2..12, or null for Dunes. */
  token: number | null;
}

export interface Harbor {
  /** Coastal edge id the harbor sits on; both its vertices get the harbor. */
  edge: number;
  kind: HarborKind;
}

export interface Board {
  /** Indexed by hex id from the static topology. */
  hexes: HexTile[];
  harbors: Harbor[];
}

export type BuildingKind = 'outpost' | 'town';

export interface Building {
  owner: Seat;
  kind: BuildingKind;
}

export interface PlayerState {
  seat: Seat;
  userId: string;
  name: string;
  hand: ResourceCounts;
  fortune: FortuneCard[];
  wardensPlayed: number;
  trailsLeft: number;
  outpostsLeft: number;
  townsLeft: number;
}

export interface TradeOffer {
  id: number;
  from: Seat;
  /** Seats the offer is addressed to. */
  to: Seat[];
  /** What `from` gives. */
  give: ResourceCounts;
  /** What `from` receives. */
  get: ResourceCounts;
  /** Seats that already declined. */
  declined: Seat[];
  turn: number;
}

export type Phase =
  | { kind: 'setup'; order: Seat[]; index: number; step: 'outpost' | 'trail'; lastOutpost: number | null }
  | { kind: 'roll' }
  | { kind: 'discard'; pending: Record<string, number> }
  | { kind: 'raider'; returnTo: 'roll' | 'main' }
  | { kind: 'main' }
  | { kind: 'trailblazer'; remaining: number }
  | { kind: 'ended'; winner: Seat };

export interface Award {
  holder: Seat | null;
  /** Length of the holder's trail / number of wardens. */
  size: number;
}

export interface GameConfig {
  vpToWin: number;
  discardLimit: number;
}

export interface GameState {
  version: 1;
  config: GameConfig;
  board: Board;
  raiderHex: number;
  players: PlayerState[];
  /** Indexed by vertex id. */
  buildings: (Building | null)[];
  /** Indexed by edge id: owning seat or null. */
  trails: (Seat | null)[];
  bank: ResourceCounts;
  fortuneDeck: FortuneKind[];
  nextFortuneId: number;
  phase: Phase;
  currentSeat: Seat;
  /** Increments each time a regular (post-setup) turn starts. Setup is turn 0. */
  turn: number;
  dice: [number, number] | null;
  /** Whether the current player already played a Fortune card this turn. */
  fortunePlayedThisTurn: boolean;
  offers: TradeOffer[];
  nextOfferId: number;
  longestTrail: Award;
  grandWatch: Award;
  /** mulberry32 state — secret, never sent to clients. */
  rng: number;
  /** Number of actions applied so far. */
  seq: number;
}

// ---------------------------------------------------------------------------
// Actions

export type Action =
  | { type: 'placeSetupOutpost'; vertex: number }
  | { type: 'placeSetupTrail'; edge: number }
  | { type: 'roll' }
  | { type: 'discard'; cards: ResourceCounts }
  | { type: 'moveRaider'; hex: number; victim?: Seat | null }
  | { type: 'buildTrail'; edge: number }
  | { type: 'buildOutpost'; vertex: number }
  | { type: 'buildTown'; vertex: number }
  | { type: 'buyFortune' }
  | { type: 'playWarden' }
  | { type: 'playTrailblazer' }
  | { type: 'playWindfall'; resources: [Resource, Resource] }
  | { type: 'playEmbargo'; resource: Resource }
  | { type: 'harborTrade'; give: Resource; get: Resource }
  | { type: 'offerTrade'; to: Seat[]; give: ResourceCounts; get: ResourceCounts }
  | { type: 'respondTrade'; offerId: number; accept: boolean }
  | { type: 'cancelTrade'; offerId: number }
  | { type: 'endTurn' }
  | { type: 'timeout' };

export type ActionType = Action['type'];

/** Who is submitting an action: a seat, or the server itself (timers). */
export type Actor = Seat | 'system';

// ---------------------------------------------------------------------------
// Events

export type GameEvent =
  | { type: 'turnStarted'; seat: Seat; turn: number }
  | { type: 'diceRolled'; seat: Seat; dice: [number, number]; total: number }
  | { type: 'produced'; gains: Record<string, Partial<ResourceCounts>>; blocked: Resource[] }
  | { type: 'discardRequired'; pending: Record<string, number> }
  | { type: 'discarded'; seat: Seat; cards: ResourceCounts; auto: boolean }
  | { type: 'raiderMoved'; seat: Seat; hex: number }
  /** `resource` is null when redacted for third parties, or when nothing could be stolen. */
  | { type: 'stole'; thief: Seat; victim: Seat; resource: Resource | null }
  | { type: 'built'; seat: Seat; kind: 'trail' | 'outpost' | 'town'; at: number; free: boolean }
  | { type: 'setupGains'; seat: Seat; gains: Partial<ResourceCounts> }
  /** `kind` is null when redacted for other players. */
  | { type: 'fortuneBought'; seat: Seat; kind: FortuneKind | null; cardId: number | null }
  | { type: 'fortunePlayed'; seat: Seat; kind: FortuneKind }
  | { type: 'windfallTaken'; seat: Seat; resources: Resource[] }
  | { type: 'embargoCollected'; seat: Seat; resource: Resource; from: Record<string, number>; total: number }
  | { type: 'harborTraded'; seat: Seat; give: Resource; giveCount: number; get: Resource }
  | { type: 'tradeOffered'; offer: TradeOffer }
  | { type: 'tradeResolved'; offerId: number; outcome: 'accepted' | 'declined' | 'cancelled' | 'expired' | 'failed'; by: Seat | null; from: Seat; give: ResourceCounts; get: ResourceCounts }
  | { type: 'turnEnded'; seat: Seat }
  | { type: 'turnSkipped'; seat: Seat; reason: 'timeout' }
  | { type: 'awardChanged'; award: 'longestTrail' | 'grandWatch'; holder: Seat | null; previous: Seat | null; size: number }
  | { type: 'gameWon'; seat: Seat; vp: number; scores: number[]; relics: number[] };

export type GameEventType = GameEvent['type'];

export interface EngineError {
  code: string;
  message: string;
}

export type ApplyResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: EngineError };
