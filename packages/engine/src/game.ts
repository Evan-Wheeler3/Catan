// The authoritative reducer: createGame() and applyAction().
// Pure with respect to its inputs: the input state is never mutated, and all randomness
// comes from the seeded RNG stored inside the state.

import { generateBoard } from './board.ts';
import {
  BANK_PER_RESOURCE,
  COSTS,
  FORTUNE_POOL,
  GRAND_WATCH_MIN,
  LONGEST_TRAIL_MIN,
  PIECES,
  TERRAIN_RESOURCE,
  addCards,
  counts,
  emptyCounts,
  hasCards,
  isResource,
  isValidCounts,
  totalCards,
} from './constants.ts';
import { topology } from './geometry.ts';
import {
  harborRates,
  isVertexFree,
  longestTrail,
  publicVictoryPoints,
  raiderVictims,
  validOutposts,
  validRaiderHexes,
  validSetupOutposts,
  validTrails,
} from './queries.ts';
import { createRng, shuffle, type Rng } from './rng.ts';
import type {
  Action,
  Actor,
  ApplyResult,
  FortuneKind,
  GameConfig,
  GameEvent,
  GameState,
  PlayerState,
  Resource,
  ResourceCounts,
  Seat,
} from './types.ts';
import { RESOURCES } from './types.ts';

export class RuleError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const fail = (code: string, message: string): never => {
  throw new RuleError(code, message);
};

export interface NewPlayer {
  userId: string;
  name: string;
}

export interface CreateGameOptions {
  seed: number;
  players: NewPlayer[];
  /** Shuffle seating (and therefore who goes first). Default true. */
  shuffleSeats?: boolean;
  config?: Partial<GameConfig>;
}

export function createGame(opts: CreateGameOptions): GameState {
  if (opts.players.length < 2 || opts.players.length > 4) {
    throw new RuleError('bad_player_count', 'Tideholm needs 2 to 4 players.');
  }
  const rng = createRng(opts.seed);
  const board = generateBoard(rng);
  const seating = opts.shuffleSeats === false ? opts.players : shuffle(rng, opts.players);
  const n = seating.length;
  const players: PlayerState[] = seating.map((p, seat) => ({
    seat,
    userId: p.userId,
    name: p.name,
    hand: emptyCounts(),
    fortune: [],
    wardensPlayed: 0,
    trailsLeft: PIECES.trails,
    outpostsLeft: PIECES.outposts,
    townsLeft: PIECES.towns,
  }));
  const order = [...Array(n).keys(), ...[...Array(n).keys()].reverse()];
  const topo = topology();
  const fortuneDeck = shuffle(rng, FORTUNE_POOL);
  return {
    version: 1,
    config: { vpToWin: 10, discardLimit: 7, ...opts.config },
    board,
    raiderHex: board.hexes.findIndex((h) => h.terrain === 'dunes'),
    players,
    buildings: topo.vertices.map(() => null),
    trails: topo.edges.map(() => null),
    bank: counts({
      timber: BANK_PER_RESOURCE,
      clay: BANK_PER_RESOURCE,
      fleece: BANK_PER_RESOURCE,
      grain: BANK_PER_RESOURCE,
      stone: BANK_PER_RESOURCE,
    }),
    fortuneDeck,
    nextFortuneId: 1,
    phase: { kind: 'setup', order, index: 0, step: 'outpost', lastOutpost: null },
    currentSeat: order[0],
    turn: 0,
    dice: null,
    fortunePlayedThisTurn: false,
    offers: [],
    nextOfferId: 1,
    longestTrail: { holder: null, size: 0 },
    grandWatch: { holder: null, size: 0 },
    rng: rng.state(),
    seq: 0,
  };
}

interface Ctx {
  s: GameState;
  rng: Rng;
  events: GameEvent[];
}

export function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

/**
 * Validates and applies an action. Never throws for rule violations or malformed input;
 * returns `{ ok: false, error }` instead.
 */
export function applyAction(state: GameState, actor: Actor, action: Action): ApplyResult {
  const s = cloneState(state);
  const ctx: Ctx = { s, rng: createRng(s.rng), events: [] };
  try {
    if (!action || typeof action !== 'object' || typeof (action as { type?: unknown }).type !== 'string') {
      fail('bad_action', 'That move was not understood.');
    }
    if (s.phase.kind === 'ended') fail('game_over', 'This game has already finished.');
    if (actor === 'system') {
      if (action.type !== 'timeout') fail('forbidden', 'The server can only apply timeouts.');
      handleTimeout(ctx);
    } else {
      if (!Number.isInteger(actor) || actor < 0 || actor >= s.players.length) fail('not_in_game', 'You are not seated in this game.');
      if (action.type === 'timeout') fail('forbidden', 'Only the server can skip a turn.');
      dispatch(ctx, actor, action);
    }
    checkWin(ctx);
  } catch (err) {
    if (err instanceof RuleError) return { ok: false, error: { code: err.code, message: err.message } };
    throw err;
  }
  s.rng = ctx.rng.state();
  s.seq += 1;
  return { ok: true, state: s, events: ctx.events };
}

// ---------------------------------------------------------------------------

function dispatch(ctx: Ctx, seat: Seat, a: Action): void {
  // Actions any seated player may take regardless of whose turn it is.
  switch (a.type) {
    case 'discard':
      return discard(ctx, seat, a.cards, false);
    case 'respondTrade':
      return respondTrade(ctx, seat, a.offerId, a.accept);
    case 'cancelTrade':
      return cancelTrade(ctx, seat, a.offerId);
    case 'offerTrade':
      return offerTrade(ctx, seat, a.to, a.give, a.get);
  }
  if (seat !== ctx.s.currentSeat) fail('not_your_turn', "It's not your turn yet.");
  switch (a.type) {
    case 'placeSetupOutpost':
      return placeSetupOutpost(ctx, seat, a.vertex);
    case 'placeSetupTrail':
      return placeSetupTrail(ctx, seat, a.edge);
    case 'roll':
      return roll(ctx, seat);
    case 'moveRaider':
      return moveRaider(ctx, seat, a.hex, a.victim ?? null);
    case 'buildTrail':
      return buildTrail(ctx, seat, a.edge);
    case 'buildOutpost':
      return buildOutpost(ctx, seat, a.vertex);
    case 'buildTown':
      return buildTown(ctx, seat, a.vertex);
    case 'buyFortune':
      return buyFortune(ctx, seat);
    case 'playWarden':
      return playWarden(ctx, seat);
    case 'playTrailblazer':
      return playTrailblazer(ctx, seat);
    case 'playWindfall':
      return playWindfall(ctx, seat, a.resources);
    case 'playEmbargo':
      return playEmbargo(ctx, seat, a.resource);
    case 'harborTrade':
      return harborTrade(ctx, seat, a.give, a.get);
    case 'endTurn':
      return endTurn(ctx, seat);
    default:
      fail('bad_action', 'That move was not understood.');
  }
}

function requirePhase<K extends GameState['phase']['kind']>(s: GameState, ...kinds: K[]): void {
  if (!kinds.includes(s.phase.kind as K)) {
    const hints: Record<string, string> = {
      setup: 'Finish placing your starting pieces first.',
      roll: 'Roll the dice first.',
      discard: 'Waiting for players to discard.',
      raider: 'Move the Raider first.',
      main: "You can't do that right now.",
      trailblazer: 'Place your free trails first.',
    };
    fail('wrong_phase', hints[s.phase.kind] ?? "You can't do that right now.");
  }
}

function int(v: unknown, max: number, what: string): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v >= max) fail('bad_input', `Invalid ${what}.`);
  return v as number;
}

function pay(ctx: Ctx, seat: Seat, cost: ResourceCounts): void {
  const p = ctx.s.players[seat];
  if (!hasCards(p.hand, cost)) fail('cannot_afford', "You don't have enough resources for that.");
  addCards(p.hand, cost, -1);
  addCards(ctx.s.bank, cost, 1);
}

// --- Setup -----------------------------------------------------------------

function placeSetupOutpost(ctx: Ctx, seat: Seat, vertexIn: number): void {
  const { s } = ctx;
  if (s.phase.kind !== 'setup' || s.phase.step !== 'outpost') fail('wrong_phase', 'Place your trail first.');
  const vertex = int(vertexIn, topology().vertices.length, 'spot');
  if (!isVertexFree(s, vertex)) fail('too_close', 'Outposts need at least two trail-lengths between them.');
  const phase = s.phase as Extract<GameState['phase'], { kind: 'setup' }>;
  s.buildings[vertex] = { owner: seat, kind: 'outpost' };
  s.players[seat].outpostsLeft--;
  ctx.events.push({ type: 'built', seat, kind: 'outpost', at: vertex, free: true });

  // The second outpost of setup yields one of each adjacent resource.
  if (phase.index >= s.players.length) {
    const gains: Partial<ResourceCounts> = {};
    for (const h of topology().vertices[vertex].hexes) {
      const res = TERRAIN_RESOURCE[s.board.hexes[h].terrain];
      if (res && s.bank[res] > 0) {
        s.bank[res]--;
        s.players[seat].hand[res]++;
        gains[res] = (gains[res] ?? 0) + 1;
      }
    }
    ctx.events.push({ type: 'setupGains', seat, gains });
  }
  phase.step = 'trail';
  phase.lastOutpost = vertex;
}

function placeSetupTrail(ctx: Ctx, seat: Seat, edgeIn: number): void {
  const { s } = ctx;
  if (s.phase.kind !== 'setup' || s.phase.step !== 'trail') fail('wrong_phase', 'Place your outpost first.');
  const phase = s.phase as Extract<GameState['phase'], { kind: 'setup' }>;
  const edge = int(edgeIn, topology().edges.length, 'trail');
  if (!validTrails(s, seat, phase.lastOutpost).includes(edge)) fail('not_connected', 'Your trail must start at the outpost you just placed.');
  s.trails[edge] = seat;
  s.players[seat].trailsLeft--;
  ctx.events.push({ type: 'built', seat, kind: 'trail', at: edge, free: true });

  phase.index++;
  phase.step = 'outpost';
  phase.lastOutpost = null;
  if (phase.index >= phase.order.length) {
    startTurn(ctx, phase.order[0], 1);
  } else {
    s.currentSeat = phase.order[phase.index];
  }
}

// --- Turn flow -------------------------------------------------------------

function startTurn(ctx: Ctx, seat: Seat, turn: number): void {
  const { s } = ctx;
  s.currentSeat = seat;
  s.turn = turn;
  s.phase = { kind: 'roll' };
  s.dice = null;
  s.fortunePlayedThisTurn = false;
  ctx.events.push({ type: 'turnStarted', seat, turn });
}

function roll(ctx: Ctx, seat: Seat): void {
  const { s, rng } = ctx;
  requirePhase(s, 'roll');
  const dice: [number, number] = [1 + rng.int(6), 1 + rng.int(6)];
  const total = dice[0] + dice[1];
  s.dice = dice;
  ctx.events.push({ type: 'diceRolled', seat, dice, total });
  if (total === 7) {
    const pending: Record<string, number> = {};
    for (const p of s.players) {
      const n = totalCards(p.hand);
      if (n > s.config.discardLimit) pending[p.seat] = Math.floor(n / 2);
    }
    if (Object.keys(pending).length > 0) {
      s.phase = { kind: 'discard', pending };
      ctx.events.push({ type: 'discardRequired', pending: { ...pending } });
    } else {
      s.phase = { kind: 'raider', returnTo: 'main' };
    }
    return;
  }
  produce(ctx, total);
  s.phase = { kind: 'main' };
}

/** Pays out resources for a roll, applying the bank-shortage rule. */
export function produce(ctx: Ctx, total: number): void {
  const { s } = ctx;
  const topo = topology();
  const claims: Record<Resource, Map<Seat, number>> = {
    timber: new Map(),
    clay: new Map(),
    fleece: new Map(),
    grain: new Map(),
    stone: new Map(),
  };
  s.board.hexes.forEach((hex, id) => {
    if (hex.token !== total || id === s.raiderHex) return;
    const res = TERRAIN_RESOURCE[hex.terrain];
    if (!res) return;
    for (const v of topo.hexes[id].vertices) {
      const b = s.buildings[v];
      if (!b) continue;
      claims[res].set(b.owner, (claims[res].get(b.owner) ?? 0) + (b.kind === 'town' ? 2 : 1));
    }
  });

  const gains: Record<string, Partial<ResourceCounts>> = {};
  const blocked: Resource[] = [];
  const give = (seat: Seat, res: Resource, n: number) => {
    if (n <= 0) return;
    s.bank[res] -= n;
    s.players[seat].hand[res] += n;
    gains[seat] = gains[seat] ?? {};
    gains[seat][res] = (gains[seat][res] ?? 0) + n;
  };
  for (const res of RESOURCES) {
    const map = claims[res];
    if (map.size === 0) continue;
    const owed = [...map.values()].reduce((a, b) => a + b, 0);
    if (owed <= s.bank[res]) {
      for (const [seat, n] of map) give(seat, res, n);
    } else if (map.size === 1) {
      const [seat] = [...map.keys()];
      give(seat, res, s.bank[res]);
    } else {
      blocked.push(res);
    }
  }
  ctx.events.push({ type: 'produced', gains, blocked });
}

function discard(ctx: Ctx, seat: Seat, cards: ResourceCounts, auto: boolean): void {
  const { s } = ctx;
  if (s.phase.kind !== 'discard') fail('wrong_phase', 'Nobody needs to discard right now.');
  const phase = s.phase as Extract<GameState['phase'], { kind: 'discard' }>;
  const owed = phase.pending[seat];
  if (owed === undefined) fail('no_discard', "You don't need to discard.");
  if (!isValidCounts(cards)) fail('bad_input', 'Invalid cards.');
  const c = counts(cards);
  if (totalCards(c) !== owed) fail('wrong_count', `Choose exactly ${owed} cards to discard.`);
  if (!hasCards(s.players[seat].hand, c)) fail('cannot_afford', "You don't have those cards.");
  addCards(s.players[seat].hand, c, -1);
  addCards(s.bank, c, 1);
  delete phase.pending[seat];
  ctx.events.push({ type: 'discarded', seat, cards: c, auto });
  if (Object.keys(phase.pending).length === 0) s.phase = { kind: 'raider', returnTo: 'main' };
}

function moveRaider(ctx: Ctx, seat: Seat, hexIn: number, victim: Seat | null): void {
  const { s, rng } = ctx;
  requirePhase(s, 'raider');
  const returnTo = (s.phase as Extract<GameState['phase'], { kind: 'raider' }>).returnTo;
  const hex = int(hexIn, topology().hexes.length, 'tile');
  if (hex === s.raiderHex) fail('same_hex', 'The Raider has to move to a different tile.');
  const victims = raiderVictims(s, seat, hex, (v) => totalCards(s.players[v].hand));
  if (victims.length > 0) {
    if (victim === null && victims.length === 1) victim = victims[0];
    if (victim === null || !victims.includes(victim)) fail('bad_victim', 'Choose a player next to that tile to steal from.');
  } else {
    victim = null;
  }
  s.raiderHex = hex;
  ctx.events.push({ type: 'raiderMoved', seat, hex });
  if (victim !== null) {
    const hand = s.players[victim].hand;
    const pool: Resource[] = [];
    for (const r of RESOURCES) for (let i = 0; i < hand[r]; i++) pool.push(r);
    const res = pool[rng.int(pool.length)];
    hand[res]--;
    s.players[seat].hand[res]++;
    ctx.events.push({ type: 'stole', thief: seat, victim, resource: res });
  }
  s.phase = { kind: returnTo };
}

function endTurn(ctx: Ctx, seat: Seat): void {
  const { s } = ctx;
  requirePhase(s, 'main');
  expireOffers(ctx);
  ctx.events.push({ type: 'turnEnded', seat });
  startTurn(ctx, (seat + 1) % s.players.length, s.turn + 1);
}

// --- Building --------------------------------------------------------------

function buildTrail(ctx: Ctx, seat: Seat, edgeIn: number): void {
  const { s } = ctx;
  requirePhase(s, 'main', 'trailblazer');
  const edge = int(edgeIn, topology().edges.length, 'trail');
  const p = s.players[seat];
  if (p.trailsLeft <= 0) fail('no_pieces', "You've placed all 15 of your trails.");
  if (!validTrails(s, seat).includes(edge)) fail('not_connected', 'Trails must connect to your own trail, outpost or town.');
  const free = s.phase.kind === 'trailblazer';
  if (!free) pay(ctx, seat, COSTS.trail);
  s.trails[edge] = seat;
  p.trailsLeft--;
  ctx.events.push({ type: 'built', seat, kind: 'trail', at: edge, free });
  if (s.phase.kind === 'trailblazer') {
    s.phase.remaining--;
    if (s.phase.remaining <= 0 || p.trailsLeft <= 0 || validTrails(s, seat).length === 0) s.phase = { kind: 'main' };
  }
  updateLongestTrail(ctx);
}

function buildOutpost(ctx: Ctx, seat: Seat, vertexIn: number): void {
  const { s } = ctx;
  requirePhase(s, 'main');
  const vertex = int(vertexIn, topology().vertices.length, 'spot');
  const p = s.players[seat];
  if (p.outpostsLeft <= 0) fail('no_pieces', 'All five of your outposts are on the board. Upgrade one to a town.');
  if (!isVertexFree(s, vertex)) fail('too_close', 'Outposts need at least two trail-lengths between them.');
  if (!validOutposts(s, seat).includes(vertex)) fail('not_connected', 'Outposts must sit at the end of one of your trails.');
  pay(ctx, seat, COSTS.outpost);
  s.buildings[vertex] = { owner: seat, kind: 'outpost' };
  p.outpostsLeft--;
  ctx.events.push({ type: 'built', seat, kind: 'outpost', at: vertex, free: false });
  // A new outpost can cut an opponent's trail in two.
  updateLongestTrail(ctx);
}

function buildTown(ctx: Ctx, seat: Seat, vertexIn: number): void {
  const { s } = ctx;
  requirePhase(s, 'main');
  const vertex = int(vertexIn, topology().vertices.length, 'spot');
  const p = s.players[seat];
  const b = s.buildings[vertex];
  if (!b || b.owner !== seat || b.kind !== 'outpost') fail('not_outpost', 'Towns are built by upgrading one of your outposts.');
  if (p.townsLeft <= 0) fail('no_pieces', 'All four of your towns are already built.');
  pay(ctx, seat, COSTS.town);
  s.buildings[vertex] = { owner: seat, kind: 'town' };
  p.townsLeft--;
  p.outpostsLeft++;
  ctx.events.push({ type: 'built', seat, kind: 'town', at: vertex, free: false });
}

// --- Fortune cards ---------------------------------------------------------

function buyFortune(ctx: Ctx, seat: Seat): void {
  const { s } = ctx;
  requirePhase(s, 'main');
  if (s.fortuneDeck.length === 0) fail('deck_empty', 'The Fortune deck is empty.');
  pay(ctx, seat, COSTS.fortune);
  const kind = s.fortuneDeck.shift()!;
  const card = { id: s.nextFortuneId++, kind, boughtOnTurn: s.turn };
  s.players[seat].fortune.push(card);
  ctx.events.push({ type: 'fortuneBought', seat, kind, cardId: card.id });
}

function takePlayable(ctx: Ctx, seat: Seat, kind: FortuneKind): void {
  const { s } = ctx;
  if (s.fortunePlayedThisTurn) fail('one_per_turn', 'You can only play one Fortune card per turn.');
  const p = s.players[seat];
  const idx = p.fortune.findIndex((c) => c.kind === kind && c.boughtOnTurn < s.turn);
  if (idx < 0) {
    const fresh = p.fortune.some((c) => c.kind === kind);
    fail(fresh ? 'too_fresh' : 'no_card', fresh ? "Fortune cards can't be played on the turn you buy them." : "You don't have that Fortune card.");
  }
  p.fortune.splice(idx, 1);
  s.fortunePlayedThisTurn = true;
  ctx.events.push({ type: 'fortunePlayed', seat, kind });
}

function playWarden(ctx: Ctx, seat: Seat): void {
  const { s } = ctx;
  requirePhase(s, 'roll', 'main');
  const returnTo = s.phase.kind as 'roll' | 'main';
  takePlayable(ctx, seat, 'warden');
  s.players[seat].wardensPlayed++;
  updateGrandWatch(ctx);
  s.phase = { kind: 'raider', returnTo };
}

function playTrailblazer(ctx: Ctx, seat: Seat): void {
  const { s } = ctx;
  requirePhase(s, 'main');
  takePlayable(ctx, seat, 'trailblazer');
  const remaining = Math.min(2, s.players[seat].trailsLeft);
  if (remaining > 0 && validTrails(s, seat).length > 0) s.phase = { kind: 'trailblazer', remaining };
}

function playWindfall(ctx: Ctx, seat: Seat, resources: [Resource, Resource]): void {
  const { s } = ctx;
  requirePhase(s, 'main');
  if (!Array.isArray(resources) || resources.length !== 2 || !resources.every(isResource)) fail('bad_input', 'Pick two resources.');
  const want = counts({});
  for (const r of resources) want[r]++;
  if (!hasCards(s.bank, want)) fail('bank_empty', "The bank doesn't have enough of that.");
  takePlayable(ctx, seat, 'windfall');
  addCards(s.bank, want, -1);
  addCards(s.players[seat].hand, want, 1);
  ctx.events.push({ type: 'windfallTaken', seat, resources: [...resources] });
}

function playEmbargo(ctx: Ctx, seat: Seat, resource: Resource): void {
  const { s } = ctx;
  requirePhase(s, 'main');
  if (!isResource(resource)) fail('bad_input', 'Pick a resource.');
  takePlayable(ctx, seat, 'embargo');
  const from: Record<string, number> = {};
  let total = 0;
  for (const p of s.players) {
    if (p.seat === seat || p.hand[resource] === 0) continue;
    from[p.seat] = p.hand[resource];
    total += p.hand[resource];
    s.players[seat].hand[resource] += p.hand[resource];
    p.hand[resource] = 0;
  }
  ctx.events.push({ type: 'embargoCollected', seat, resource, from, total });
}

// --- Trading ---------------------------------------------------------------

function harborTrade(ctx: Ctx, seat: Seat, give: Resource, get: Resource): void {
  const { s } = ctx;
  requirePhase(s, 'main');
  if (!isResource(give) || !isResource(get) || give === get) fail('bad_input', 'Pick two different resources.');
  const rate = harborRates(s, seat)[give];
  const p = s.players[seat];
  if (p.hand[give] < rate) fail('cannot_afford', `You need ${rate} ${give} for that trade.`);
  if (s.bank[get] < 1) fail('bank_empty', `The bank is out of ${get}.`);
  p.hand[give] -= rate;
  s.bank[give] += rate;
  s.bank[get] -= 1;
  p.hand[get] += 1;
  ctx.events.push({ type: 'harborTraded', seat, give, giveCount: rate, get });
}

const MAX_OPEN_OFFERS = 6;

function offerTrade(ctx: Ctx, seat: Seat, to: Seat[], give: ResourceCounts, get: ResourceCounts): void {
  const { s } = ctx;
  if (s.phase.kind !== 'main') fail('wrong_phase', 'Trades happen after the dice are rolled.');
  if (!isValidCounts(give) || !isValidCounts(get)) fail('bad_input', 'Invalid trade.');
  const g = counts(give);
  const w = counts(get);
  if (totalCards(g) === 0 || totalCards(w) === 0) fail('empty_trade', 'A trade needs something on both sides.');
  if (RESOURCES.some((r) => g[r] > 0 && w[r] > 0)) fail('bad_trade', "You can't give and ask for the same resource.");
  if (!Array.isArray(to) || to.length === 0) fail('bad_input', 'Pick who to trade with.');
  const targets = [...new Set(to)];
  for (const t of targets) {
    if (!Number.isInteger(t) || t < 0 || t >= s.players.length || t === seat) fail('bad_input', 'Invalid trade partner.');
  }
  // Every trade must involve the player whose turn it is.
  if (seat !== s.currentSeat && (targets.length !== 1 || targets[0] !== s.currentSeat)) {
    fail('not_your_turn', 'You can only offer trades to the player whose turn it is.');
  }
  if (!hasCards(s.players[seat].hand, g)) fail('cannot_afford', "You don't have the cards you're offering.");
  if (s.offers.filter((o) => o.from === seat).length >= MAX_OPEN_OFFERS) fail('too_many_offers', 'You have too many open offers. Withdraw one first.');
  const offer = { id: s.nextOfferId++, from: seat, to: targets.sort((a, b) => a - b), give: g, get: w, declined: [], turn: s.turn };
  s.offers.push(offer);
  ctx.events.push({ type: 'tradeOffered', offer: JSON.parse(JSON.stringify(offer)) });
}

function respondTrade(ctx: Ctx, seat: Seat, offerId: number, accept: boolean): void {
  const { s } = ctx;
  const idx = s.offers.findIndex((o) => o.id === offerId);
  if (idx < 0) fail('no_offer', 'That offer is no longer available.');
  const offer = s.offers[idx];
  if (!offer.to.includes(seat) || offer.declined.includes(seat)) fail('not_for_you', "That offer isn't addressed to you.");
  const resolved = (outcome: 'accepted' | 'declined' | 'failed', by: Seat | null) =>
    ctx.events.push({ type: 'tradeResolved', offerId, outcome, by, from: offer.from, give: offer.give, get: offer.get });

  if (!accept) {
    offer.declined.push(seat);
    resolved('declined', seat);
    if (offer.declined.length === offer.to.length) s.offers.splice(idx, 1);
    return;
  }
  if (s.phase.kind !== 'main') fail('wrong_phase', 'Trades can be accepted once the active player has rolled.');
  if (!hasCards(s.players[seat].hand, offer.get)) fail('cannot_afford', "You don't have the cards they're asking for.");
  s.offers.splice(idx, 1);
  if (!hasCards(s.players[offer.from].hand, offer.give)) {
    resolved('failed', seat);
    return;
  }
  addCards(s.players[offer.from].hand, offer.give, -1);
  addCards(s.players[seat].hand, offer.give, 1);
  addCards(s.players[seat].hand, offer.get, -1);
  addCards(s.players[offer.from].hand, offer.get, 1);
  resolved('accepted', seat);
}

function cancelTrade(ctx: Ctx, seat: Seat, offerId: number): void {
  const { s } = ctx;
  const idx = s.offers.findIndex((o) => o.id === offerId);
  if (idx < 0) fail('no_offer', 'That offer is no longer available.');
  const offer = s.offers[idx];
  if (offer.from !== seat) fail('not_yours', 'You can only withdraw your own offers.');
  s.offers.splice(idx, 1);
  ctx.events.push({ type: 'tradeResolved', offerId, outcome: 'cancelled', by: seat, from: offer.from, give: offer.give, get: offer.get });
}

function expireOffers(ctx: Ctx): void {
  for (const o of ctx.s.offers) {
    ctx.events.push({ type: 'tradeResolved', offerId: o.id, outcome: 'expired', by: null, from: o.from, give: o.give, get: o.get });
  }
  ctx.s.offers = [];
}

// --- Awards & winning --------------------------------------------------------

/**
 * Recomputes the Longest Trail. The holder keeps it on a tie; if the holder drops below
 * the leader(s) and several players tie for the lead, nobody holds it.
 */
export function updateLongestTrail(ctx: Ctx): void {
  const { s } = ctx;
  const lengths = s.players.map((p) => longestTrail(s, p.seat));
  const max = Math.max(...lengths);
  const prev = s.longestTrail.holder;
  let holder: Seat | null;
  if (prev !== null && lengths[prev] === max && max >= LONGEST_TRAIL_MIN) {
    holder = prev;
  } else if (max < LONGEST_TRAIL_MIN) {
    holder = null;
  } else {
    const leaders = s.players.filter((p) => lengths[p.seat] === max).map((p) => p.seat);
    holder = leaders.length === 1 ? leaders[0] : null;
  }
  const size = holder === null ? 0 : lengths[holder];
  if (holder !== prev) ctx.events.push({ type: 'awardChanged', award: 'longestTrail', holder, previous: prev, size });
  s.longestTrail = { holder, size };
}

function updateGrandWatch(ctx: Ctx): void {
  const { s } = ctx;
  const prev = s.grandWatch.holder;
  const prevSize = prev === null ? 0 : s.players[prev].wardensPlayed;
  for (const p of s.players) {
    if (p.wardensPlayed >= GRAND_WATCH_MIN && p.wardensPlayed > prevSize && p.seat !== prev) {
      s.grandWatch = { holder: p.seat, size: p.wardensPlayed };
      ctx.events.push({ type: 'awardChanged', award: 'grandWatch', holder: p.seat, previous: prev, size: p.wardensPlayed });
      return;
    }
  }
  if (prev !== null) s.grandWatch.size = s.players[prev].wardensPlayed;
}

/** Total victory points including hidden Relic cards. */
export function totalVictoryPoints(s: GameState, seat: Seat): number {
  return publicVictoryPoints(s, seat) + s.players[seat].fortune.filter((c) => c.kind === 'relic').length;
}

/** A player can only win on their own turn (checked after every action). */
function checkWin(ctx: Ctx): void {
  const { s } = ctx;
  if (s.phase.kind === 'ended' || s.phase.kind === 'setup') return;
  const seat = s.currentSeat;
  const vp = totalVictoryPoints(s, seat);
  if (vp < s.config.vpToWin) return;
  expireOffers(ctx);
  s.phase = { kind: 'ended', winner: seat };
  ctx.events.push({
    type: 'gameWon',
    seat,
    vp,
    scores: s.players.map((p) => totalVictoryPoints(s, p.seat)),
    relics: s.players.map((p) => p.fortune.filter((c) => c.kind === 'relic').length),
  });
}

// --- Timeouts --------------------------------------------------------------

function randomDiscard(ctx: Ctx, seat: Seat, n: number): ResourceCounts {
  const hand = { ...ctx.s.players[seat].hand };
  const out = emptyCounts();
  for (let i = 0; i < n; i++) {
    const pool = RESOURCES.filter((r) => hand[r] > 0);
    const weights = pool.map((r) => hand[r]);
    let pick = ctx.rng.int(weights.reduce((a, b) => a + b, 0));
    let chosen = pool[0];
    for (let j = 0; j < pool.length; j++) {
      if (pick < weights[j]) {
        chosen = pool[j];
        break;
      }
      pick -= weights[j];
    }
    hand[chosen]--;
    out[chosen]++;
  }
  return out;
}

/**
 * The turn timer ran out: resolve everything pending with sensible random choices and
 * pass the turn (or the setup placement) to the next player.
 */
function handleTimeout(ctx: Ctx): void {
  const { s, rng } = ctx;
  const startTurnNo = s.turn;
  const startSetupIndex = s.phase.kind === 'setup' ? s.phase.index : -1;
  ctx.events.push({ type: 'turnSkipped', seat: s.currentSeat, reason: 'timeout' });
  const pick = <T>(items: T[]): T => items[rng.int(items.length)];

  for (let guard = 0; guard < 30; guard++) {
    const phase = s.phase;
    const seat = s.currentSeat;
    if (phase.kind === 'ended') return;
    if (phase.kind === 'setup') {
      if (phase.index !== startSetupIndex) return;
      if (phase.step === 'outpost') placeSetupOutpost(ctx, seat, pick(validSetupOutposts(s)));
      else placeSetupTrail(ctx, seat, pick(validTrails(s, seat, phase.lastOutpost)));
      continue;
    }
    if (s.turn !== startTurnNo) return;
    switch (phase.kind) {
      case 'roll':
        roll(ctx, seat);
        break;
      case 'discard':
        for (const [k, n] of Object.entries(phase.pending)) discard(ctx, Number(k), randomDiscard(ctx, Number(k), n), true);
        break;
      case 'raider': {
        const hexes = validRaiderHexes(s).filter((h) => !topology().hexes[h].vertices.some((v) => s.buildings[v]?.owner === seat));
        const hex = pick(hexes.length ? hexes : validRaiderHexes(s));
        const victims = raiderVictims(s, seat, hex, (v) => totalCards(s.players[v].hand));
        moveRaider(ctx, seat, hex, victims.length ? pick(victims) : null);
        break;
      }
      case 'trailblazer':
        buildTrail(ctx, seat, pick(validTrails(s, seat)));
        break;
      case 'main':
        endTurn(ctx, seat);
        break;
    }
  }
}

