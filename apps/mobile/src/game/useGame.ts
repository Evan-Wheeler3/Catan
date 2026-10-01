import type { Action, GameEvent } from '@tideholm/engine';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameConnection, GameSnapshot, SeqEvent } from '../data/connection';

export interface ReplayState {
  steps: SeqEvent[];
  index: number;
  /** Piece keys (`v12`, `e40`) built during unseen events that haven't been revealed yet. */
  hidden: Set<string>;
}

export function pieceKey(e: GameEvent): string | null {
  if (e.type !== 'built') return null;
  return e.kind === 'trail' ? `e${e.at}` : `v${e.at}`;
}

/** Events worth a step in the "since you were last here" replay. */
function isReplayStep(e: GameEvent, mySeat: number | null): boolean {
  switch (e.type) {
    case 'built':
    case 'diceRolled':
    case 'stole':
    case 'fortunePlayed':
    case 'tradeResolved':
    case 'harborTraded':
    case 'awardChanged':
    case 'gameWon':
    case 'turnSkipped':
    case 'embargoCollected':
      return !('seat' in e) || e.seat !== mySeat || e.type === 'gameWon';
    case 'tradeOffered':
      return e.offer.from !== mySeat;
    default:
      return false;
  }
}

export function useGame(conn: GameConnection) {
  const [snap, setSnap] = useState<GameSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [log, setLog] = useState<SeqEvent[]>([]);
  const [replay, setReplay] = useState<ReplayState | null>(null);
  const [lastEvents, setLastEvents] = useState<SeqEvent[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let unsub = () => {};
    conn.open().then((res) => {
      if (!mounted.current) return;
      if ('error' in res) {
        setError(res.error);
        return;
      }
      setSnap(res.snapshot);
      setLog(res.unseen);
      const me = res.snapshot.mySeat;
      const steps = res.unseen.filter((e) => isReplayStep(e.event, me));
      if (steps.length > 0) {
        const hidden = new Set(steps.map((s) => pieceKey(s.event)).filter((k): k is string => !!k));
        setReplay({ steps, index: 0, hidden });
      } else {
        conn.markSeen(res.snapshot.view.seq);
      }
      unsub = conn.subscribe((s) => {
        if (!mounted.current) return;
        setSnap(s);
        if (s.fresh.length) {
          setLog((prev) => [...prev, ...s.fresh].slice(-300));
          setLastEvents(s.fresh);
          const keys = s.fresh.map((e) => pieceKey(e.event)).filter((k): k is string => !!k);
          if (s.fresh.some((e) => e.event.type === 'raiderMoved')) keys.push('raider');
          if (keys.length) setFresh(new Set(keys));
          conn.markSeen(s.view.seq);
        }
      });
    });
    return () => {
      mounted.current = false;
      unsub();
      conn.close();
    };
  }, [conn]);

  const submit = useCallback(
    async (action: Action): Promise<boolean> => {
      setBusy(true);
      const res = await conn.submit(action);
      if (mounted.current) {
        setBusy(false);
        if (!res.ok) setNotice(res.message);
      }
      return res.ok;
    },
    [conn],
  );

  const advanceReplay = useCallback(() => {
    setReplay((r) => {
      if (!r) return r;
      const step = r.steps[r.index];
      const key = step ? pieceKey(step.event) : null;
      const hidden = new Set(r.hidden);
      if (key) {
        hidden.delete(key);
        setFresh(new Set([key]));
      }
      if (step?.event.type === 'raiderMoved') setFresh(new Set(['raider']));
      if (r.index + 1 >= r.steps.length) return { ...r, index: r.steps.length, hidden };
      return { ...r, index: r.index + 1, hidden };
    });
  }, []);

  const finishReplay = useCallback(() => {
    setReplay(null);
    if (snap) conn.markSeen(snap.view.seq);
  }, [conn, snap]);

  return { snap, error, notice, setNotice, busy, submit, fresh, log, replay, advanceReplay, finishReplay, lastEvents };
}
