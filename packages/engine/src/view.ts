// Hidden-information boundary. The server only ever sends PlayerViews and redacted events
// to clients; the full GameState (hands, fortune cards, deck order, RNG) never leaves it.

import { totalCards } from './constants.ts';
import { totalVictoryPoints } from './game.ts';
import { publicVictoryPoints } from './queries.ts';
import type { FortuneCard, GameEvent, GameState, ResourceCounts, Seat } from './types.ts';

export interface ViewPlayer {
  seat: Seat;
  userId: string;
  name: string;
  handCount: number;
  fortuneCount: number;
  wardensPlayed: number;
  trailsLeft: number;
  outpostsLeft: number;
  townsLeft: number;
  publicVP: number;
  /** Only for the viewer themself. */
  hand: ResourceCounts | null;
  /** Only for the viewer themself. */
  fortune: FortuneCard[] | null;
  /** The viewer's own total (incl. relics); everyone's once the game has ended. */
  totalVP: number | null;
}

export type PlayerView = Omit<GameState, 'players' | 'fortuneDeck' | 'rng' | 'nextFortuneId'> & {
  viewer: Seat | null;
  deckCount: number;
  players: ViewPlayer[];
};

export function redactState(s: GameState, viewer: Seat | null): PlayerView {
  const ended = s.phase.kind === 'ended';
  const { players, fortuneDeck, rng: _rng, nextFortuneId: _n, ...rest } = s;
  return JSON.parse(
    JSON.stringify({
      ...rest,
      viewer,
      deckCount: fortuneDeck.length,
      players: players.map((p): ViewPlayer => {
        const self = p.seat === viewer;
        return {
          seat: p.seat,
          userId: p.userId,
          name: p.name,
          handCount: totalCards(p.hand),
          fortuneCount: p.fortune.length,
          wardensPlayed: p.wardensPlayed,
          trailsLeft: p.trailsLeft,
          outpostsLeft: p.outpostsLeft,
          townsLeft: p.townsLeft,
          publicVP: publicVictoryPoints(s, p.seat),
          hand: self ? p.hand : null,
          fortune: self ? p.fortune : null,
          totalVP: self || ended ? totalVictoryPoints(s, p.seat) : null,
        };
      }),
    }),
  ) as PlayerView;
}

/** True if an event contains information some players must not see. */
export function isPrivateEvent(e: GameEvent): boolean {
  return e.type === 'stole' || e.type === 'fortuneBought';
}

/** The version of an event a given seat (or a spectator, `null`) is allowed to see. */
export function redactEvent(e: GameEvent, viewer: Seat | null): GameEvent {
  switch (e.type) {
    case 'stole':
      return viewer === e.thief || viewer === e.victim ? e : { ...e, resource: null };
    case 'fortuneBought':
      return viewer === e.seat ? e : { ...e, kind: null, cardId: null };
    default:
      return e;
  }
}
