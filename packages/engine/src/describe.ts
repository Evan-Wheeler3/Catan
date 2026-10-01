// Human-readable text for events. Used by the in-game log, the "since you were last here"
// replay, and push notifications, so wording stays consistent everywhere.

import { FORTUNE_LABEL, RESOURCE_LABEL } from './constants.ts';
import type { GameEvent, ResourceCounts, Seat } from './types.ts';
import { RESOURCES } from './types.ts';

export function formatCounts(c: Partial<ResourceCounts>): string {
  const parts = RESOURCES.filter((r) => (c[r] ?? 0) > 0).map((r) => `${c[r]} ${RESOURCE_LABEL[r]}`);
  return parts.length ? parts.join(', ') : 'nothing';
}

/**
 * Describes an event from `viewer`'s point of view ("You" vs. names). Returns null for
 * events that aren't worth a line in the log.
 */
export function describeEvent(e: GameEvent, names: string[], viewer: Seat | null): string | null {
  const who = (s: Seat) => (s === viewer ? 'You' : names[s] ?? `Player ${s + 1}`);
  const whom = (s: Seat) => (s === viewer ? 'you' : names[s] ?? `Player ${s + 1}`);
  switch (e.type) {
    case 'turnStarted':
      return e.seat === viewer ? 'Your turn!' : `${who(e.seat)}'s turn`;
    case 'diceRolled':
      return `${who(e.seat)} rolled ${e.total}${e.total === 7 ? ' — Raider!' : ''}`;
    case 'produced': {
      const lines = Object.entries(e.gains).map(([seat, c]) => `${who(Number(seat))} got ${formatCounts(c)}`);
      if (e.blocked.length) lines.push(`The bank ran short of ${e.blocked.map((r) => RESOURCE_LABEL[r]).join(', ')}`);
      return lines.length ? lines.join(' · ') : 'Nobody produced anything';
    }
    case 'discardRequired':
      return null;
    case 'discarded':
      return `${who(e.seat)} discarded ${formatCounts(e.cards)}${e.auto ? ' (timer)' : ''}`;
    case 'raiderMoved':
      return `${who(e.seat)} moved the Raider`;
    case 'stole':
      return e.resource
        ? `${who(e.thief)} stole 1 ${RESOURCE_LABEL[e.resource]} from ${whom(e.victim)}`
        : `${who(e.thief)} stole a card from ${whom(e.victim)}`;
    case 'built':
      return `${who(e.seat)} built ${e.kind === 'town' ? 'a town' : e.kind === 'outpost' ? 'an outpost' : 'a trail'}`;
    case 'setupGains':
      return `${who(e.seat)} collected ${formatCounts(e.gains)}`;
    case 'fortuneBought':
      return e.kind ? `${who(e.seat)} drew a ${FORTUNE_LABEL[e.kind]} card` : `${who(e.seat)} bought a Fortune card`;
    case 'fortunePlayed':
      return `${who(e.seat)} played ${FORTUNE_LABEL[e.kind]}`;
    case 'windfallTaken':
      return `${who(e.seat)} took ${e.resources.map((r) => RESOURCE_LABEL[r]).join(' + ')} from the bank`;
    case 'embargoCollected':
      return `${who(e.seat)} collected ${e.total} ${RESOURCE_LABEL[e.resource]} with an Embargo`;
    case 'harborTraded':
      return `${who(e.seat)} traded ${e.giveCount} ${RESOURCE_LABEL[e.give]} for 1 ${RESOURCE_LABEL[e.get]}`;
    case 'tradeOffered':
      return `${who(e.offer.from)} offered ${formatCounts(e.offer.give)} for ${formatCounts(e.offer.get)}`;
    case 'tradeResolved':
      switch (e.outcome) {
        case 'accepted':
          return `${who(e.by!)} accepted ${e.from === viewer ? 'your' : `${names[e.from]}'s`} trade`;
        case 'declined':
          return `${who(e.by!)} declined a trade`;
        case 'cancelled':
          return `${who(e.from)} withdrew a trade offer`;
        case 'failed':
          return 'A trade fell through — the cards were gone';
        default:
          return null;
      }
    case 'turnEnded':
      return null;
    case 'turnSkipped':
      return `${who(e.seat)} ran out of time`;
    case 'awardChanged': {
      const award = e.award === 'longestTrail' ? 'Longest Trail' : 'Grand Watch';
      return e.holder === null ? `Nobody holds the ${award} now` : `${who(e.holder)} claimed the ${award}`;
    }
    case 'gameWon':
      return `${who(e.seat)} won with ${e.vp} points!`;
  }
}
