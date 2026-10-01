import {
  TERRAIN_RESOURCE,
  describeEvent,
  raiderVictims,
  topology,
  validOutposts,
  validRaiderHexes,
  validSetupOutposts,
  validTowns,
  validTrails,
  type Action,
  type FortuneKind,
  type Resource,
} from '@tideholm/engine';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BoardView, type BoardHandle, type Targets } from '../board/BoardView';
import { hexPos } from '../board/layout';
import type { GameConnection } from '../data/connection';
import { useFeedback } from '../lib/feedback';
import { EmptyState } from '../ui/EmptyState';
import { Icon } from '../ui/icons';
import { Banner, Button, Chip, Loading, Screen, Text } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { useSettings } from '../theme/settings';
import { radius, space } from '../theme/tokens';
import { ActionBar, type BarAction } from './ActionBar';
import { Dice } from './Dice';
import { FlyingCards, type Flight } from './FlyingCards';
import { HandFan } from './HandFan';
import { IncomingOffers } from './Offers';
import { PlayerRail } from './PlayerRail';
import { ReplayCard } from './Replay';
import { BuildSheet, DiscardSheet, FortuneSheet, StealSheet, TradeSheet, type BuildKind } from './sheets';
import { useGame } from './useGame';
import { WinOverlay } from './WinOverlay';

type SheetName = 'build' | 'trade' | 'fortune' | 'log' | null;

const BUILD_LABEL: Record<BuildKind, string> = { trail: 'trail', outpost: 'outpost', town: 'town' };

function timeLeft(deadline: string | null): string | null {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return 'Time is up';
  const h = Math.floor(ms / 3600_000);
  return h >= 1 ? `${h}h left` : `${Math.max(1, Math.round(ms / 60_000))}m left`;
}

export function GameScreen({ conn, onExit, onRematch }: { conn: GameConnection; onExit: () => void; onRematch?: () => void }) {
  const g = useGame(conn);
  const { theme } = useSettings();
  const insets = useSafeAreaInsets();
  const fb = useFeedback();
  const board = useRef<BoardHandle>(null);
  const handRef = useRef<View>(null);
  const [mode, setMode] = useState<BuildKind | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [sheet, setSheet] = useState<SheetName>(null);
  const [stealHex, setStealHex] = useState<number | null>(null);
  const [rollKey, setRollKey] = useState(0);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [winDismissed, setWinDismissed] = useState(false);

  const snap = g.snap;
  const view = snap?.view;
  const me = snap?.mySeat ?? null;
  const phase = view?.phase;
  const myTurn = !!view && me !== null && view.currentSeat === me && phase?.kind !== 'ended';

  // Leave build mode whenever the phase or turn changes underneath us.
  useEffect(() => {
    setSelected(null);
    if (phase?.kind !== 'main') setMode(null);
  }, [phase?.kind, view?.currentSeat]);

  // Auto-dismiss errors.
  useEffect(() => {
    if (!g.notice) return;
    fb.warn();
    const t = setTimeout(() => g.setNotice(null), 4500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.notice]);

  // React to new events: dice tumble, placement thunk, cards flying into the hand.
  useEffect(() => {
    if (!view || !g.lastEvents.length) return;
    const handPoint = { x: 0, y: 0 };
    handRef.current?.measureInWindow((x, y, w) => {
      handPoint.x = x + w / 2;
      handPoint.y = y + 30;
      const out: Flight[] = [];
      const topo = topology();
      for (const { event: e, seq, idx } of g.lastEvents) {
        if (e.type === 'produced' && me !== null && e.gains[me] && view.dice) {
          const total = view.dice[0] + view.dice[1];
          let n = 0;
          view.board.hexes.forEach((h, id) => {
            const res = TERRAIN_RESOURCE[h.terrain];
            if (h.token !== total || id === view.raiderHex || !res || !e.gains[me]?.[res]) return;
            for (const v of topo.hexes[id].vertices) {
              const b = view.buildings[v];
              if (b?.owner !== me) continue;
              for (let k = 0; k < (b.kind === 'town' ? 2 : 1); k++) {
                out.push({ id: `${seq}-${idx}-${id}-${v}-${k}`, resource: res, from: board.current?.toWindow(hexPos[id]) ?? handPoint, to: handPoint, delay: n++ * 70 });
              }
            }
          });
        }
        if (e.type === 'setupGains' && e.seat === me) {
          let n = 0;
          const v = view.buildings.findIndex((b, i) => b?.owner === me && topo.vertices[i].hexes.some((h) => TERRAIN_RESOURCE[view.board.hexes[h].terrain] && e.gains[TERRAIN_RESOURCE[view.board.hexes[h].terrain]!]));
          for (const h of v >= 0 ? topo.vertices[v].hexes : []) {
            const res = TERRAIN_RESOURCE[view.board.hexes[h].terrain];
            if (res) out.push({ id: `${seq}-${idx}-${h}`, resource: res, from: board.current?.toWindow(hexPos[h]) ?? handPoint, to: handPoint, delay: n++ * 90 });
          }
        }
      }
      if (out.length) {
        fb.play('card');
        setFlights((f) => [...f, ...out]);
      }
    });
    if (g.lastEvents.some((e) => e.event.type === 'diceRolled')) {
      setRollKey((k) => k + 1);
      fb.play('dice');
    }
    if (g.lastEvents.some((e) => e.event.type === 'built')) {
      fb.thunk();
      fb.play('place');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.lastEvents]);

  const targets = useMemo<Targets | null>(() => {
    if (!view || !myTurn || g.replay || me === null || !phase) return null;
    switch (phase.kind) {
      case 'setup':
        return phase.step === 'outpost'
          ? { kind: 'vertex', ids: validSetupOutposts(view), label: 'Place starting outpost' }
          : { kind: 'edge', ids: validTrails(view, me, phase.lastOutpost), label: 'Place starting trail' };
      case 'raider':
        return { kind: 'hex', ids: validRaiderHexes(view), label: 'Move the Raider here' };
      case 'trailblazer':
        return { kind: 'edge', ids: validTrails(view, me), label: 'Free trail' };
      case 'main':
        if (mode === 'trail') return { kind: 'edge', ids: validTrails(view, me), label: 'Build trail' };
        if (mode === 'outpost') return { kind: 'vertex', ids: validOutposts(view, me), label: 'Build outpost' };
        if (mode === 'town') return { kind: 'vertex', ids: validTowns(view, me), label: 'Upgrade to town' };
        return null;
      default:
        return null;
    }
  }, [view, myTurn, g.replay, me, phase, mode]);

  const shownTargets = useMemo(() => (targets && selected !== null ? { ...targets, ids: [selected] } : targets), [targets, selected]);

  const submit = useCallback(
    async (a: Action) => {
      const ok = await g.submit(a);
      if (ok) setSelected(null);
      return ok;
    },
    [g],
  );

  const confirm = useCallback(async () => {
    if (selected === null || !view || me === null || !phase) return;
    const id = selected;
    switch (phase.kind) {
      case 'setup':
        await submit(phase.step === 'outpost' ? { type: 'placeSetupOutpost', vertex: id } : { type: 'placeSetupTrail', edge: id });
        return;
      case 'raider': {
        const victims = raiderVictims(view, me, id, (s) => view.players[s].handCount);
        if (victims.length > 1) {
          setStealHex(id);
          return;
        }
        await submit({ type: 'moveRaider', hex: id, victim: victims[0] ?? null });
        return;
      }
      case 'trailblazer':
        await submit({ type: 'buildTrail', edge: id });
        return;
      case 'main':
        if (mode === 'trail') await submit({ type: 'buildTrail', edge: id });
        if (mode === 'outpost') await submit({ type: 'buildOutpost', vertex: id });
        if (mode === 'town') await submit({ type: 'buildTown', vertex: id });
        setMode(null);
    }
  }, [selected, view, me, phase, mode, submit]);

  if (g.error) {
    return (
      <Screen style={{ paddingTop: insets.top, justifyContent: 'center' }}>
        <EmptyState tone="storm" title="We couldn't open this game" body={g.error} action={<Button label="Back to the harbor" onPress={onExit} />} />
      </Screen>
    );
  }
  if (!snap || !view || !phase) return <Loading label="Unrolling the map…" />;

  const seats = snap.seats;
  const names = seats.map((s) => s.name);
  const current = seats[view.currentSeat];
  const owedDiscard = phase.kind === 'discard' && me !== null ? phase.pending[me] : undefined;
  const incomingCount = me === null ? 0 : view.offers.filter((o) => o.to.includes(me) && !o.declined.includes(me)).length;

  const prompt = (() => {
    if (phase.kind === 'ended') return 'Game over';
    if (g.replay) return 'Catching up on what you missed…';
    if (owedDiscard !== undefined) return `Discard ${owedDiscard} cards`;
    if (!myTurn) {
      if (phase.kind === 'discard') return 'Waiting for players to discard…';
      return `Waiting for ${current?.name}${phase.kind === 'setup' ? ' to place' : ''}…`;
    }
    if (selected !== null) return phase.kind === 'raider' ? 'Send the Raider here?' : 'Build here?';
    switch (phase.kind) {
      case 'setup':
        return phase.step === 'outpost' ? 'Place a starting outpost — tap a glowing spot' : 'Now add a trail leading from it';
      case 'roll':
        return 'Roll the dice!';
      case 'discard':
        return 'Waiting for players to discard…';
      case 'raider':
        return 'Move the Raider to a new tile';
      case 'trailblazer':
        return `Place a free trail (${phase.remaining} left)`;
      case 'main':
        return mode ? `Tap a glowing spot to build a ${BUILD_LABEL[mode]}` : 'Build, trade, or end your turn';
    }
  })();

  const primary: BarAction =
    myTurn && phase.kind === 'roll'
      ? { key: 'roll', label: 'Roll', icon: 'dice', primary: true, onPress: () => submit({ type: 'roll' }), disabled: g.busy }
      : { key: 'end', label: 'End turn', icon: 'flag', primary: myTurn && phase.kind === 'main', onPress: () => submit({ type: 'endTurn' }), disabled: !myTurn || phase.kind !== 'main' || g.busy || !!g.replay };
  const actions: BarAction[] = [
    { key: 'log', label: 'Log', icon: 'scroll', onPress: () => setSheet('log') },
    { key: 'fortune', label: 'Fortune', icon: 'fortune', onPress: () => setSheet('fortune'), badge: view.players[me ?? 0]?.fortuneCount || undefined, disabled: me === null },
    { key: 'trade', label: 'Trade', icon: 'trade', onPress: () => setSheet('trade'), disabled: me === null || phase.kind === 'ended' || phase.kind === 'setup', badge: incomingCount || undefined },
    { key: 'build', label: 'Build', icon: 'hammer', onPress: () => setSheet('build'), disabled: !myTurn || phase.kind !== 'main' },
    primary,
  ];

  const playFortune = async (kind: FortuneKind, extra?: { resources?: [Resource, Resource]; resource?: Resource }) => {
    const action: Action =
      kind === 'warden'
        ? { type: 'playWarden' }
        : kind === 'trailblazer'
          ? { type: 'playTrailblazer' }
          : kind === 'windfall'
            ? { type: 'playWindfall', resources: extra!.resources! }
            : { type: 'playEmbargo', resource: extra!.resource! };
    if (await submit(action)) setSheet(null);
  };

  const hand = me !== null ? view.players[me].hand : null;
  const timer = timeLeft(snap.deadline);

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + space.xs, paddingBottom: space.sm, gap: space.sm, backgroundColor: theme.color.canvas }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, gap: space.sm }}>
          <Pressable onPress={onExit} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to your games" style={{ padding: 4 }}>
            <Icon name="back" />
          </Pressable>
          <Text variant="title" style={{ flex: 1 }} numberOfLines={1} accessibilityRole="header">
            {snap.gameName}
          </Text>
          {timer && <Chip label={timer} icon={<Icon name="clock" size={14} />} />}
          {phase.kind !== 'setup' && <Chip label={`Turn ${view.turn}`} />}
        </View>
        <PlayerRail view={view} seats={seats} />
      </View>

      <View style={{ flex: 1 }}>
        <BoardView ref={board} state={view} targets={shownTargets} onTarget={(id) => { fb.tap(); setSelected(id); }} fresh={g.fresh} hidden={g.replay?.hidden} />

        <View
          style={{
            position: 'absolute',
            left: space.md,
            right: space.md,
            bottom: space.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.md,
            backgroundColor: theme.color.surface,
            borderRadius: radius.card,
            borderWidth: 2,
            borderColor: theme.color.outline,
            borderBottomWidth: 5,
            paddingVertical: space.sm,
            paddingHorizontal: space.md,
          }}
          accessibilityLiveRegion="polite"
        >
          <Text variant="label" style={{ flex: 1 }}>
            {prompt}
          </Text>
          {selected !== null ? (
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button small tone="plain" label="Cancel" onPress={() => setSelected(null)} />
              <Button small label="Confirm" onPress={confirm} loading={g.busy} />
            </View>
          ) : mode && phase.kind === 'main' ? (
            <Button small tone="plain" label="Cancel" onPress={() => setMode(null)} />
          ) : (
            <Dice dice={view.dice} rollKey={rollKey} />
          )}
        </View>

        {g.replay && <ReplayCard replay={g.replay} seats={seats} viewer={me} onNext={g.advanceReplay} onDone={g.finishReplay} />}
        {g.notice && (
          <View style={{ position: 'absolute', top: space.md, left: space.md, right: space.md }}>
            <Banner text={g.notice} onDismiss={() => g.setNotice(null)} />
          </View>
        )}
      </View>

      <View style={{ backgroundColor: theme.color.canvas, paddingTop: space.sm, paddingBottom: insets.bottom + space.sm, gap: space.sm }}>
        <IncomingOffers view={view} seats={seats} busy={g.busy} onRespond={(o, accept) => submit({ type: 'respondTrade', offerId: o.id, accept })} />
        <View ref={handRef} collapsable={false}>
          {hand ? <HandFan hand={hand} /> : null}
        </View>
        <ActionBar actions={actions} />
      </View>

      <FlyingCards flights={flights} onDone={(id) => setFlights((f) => f.filter((x) => x.id !== id))} />

      {me !== null && sheet === 'build' && (
        <BuildSheet
          visible
          view={view}
          onClose={() => setSheet(null)}
          onPick={(k) => {
            setMode(k);
            setSheet(null);
          }}
          onBuyFortune={async () => {
            if (await submit({ type: 'buyFortune' })) setSheet('fortune');
          }}
        />
      )}
      {me !== null && sheet === 'trade' && (
        <TradeSheet
          visible
          view={view}
          seats={seats}
          onClose={() => setSheet(null)}
          onOffer={async (to, give, get) => {
            if (await submit({ type: 'offerTrade', to, give, get })) g.setNotice(null);
          }}
          onHarbor={(give, get) => submit({ type: 'harborTrade', give, get })}
          onCancel={(offerId) => submit({ type: 'cancelTrade', offerId })}
        />
      )}
      {me !== null && sheet === 'fortune' && <FortuneSheet visible view={view} onClose={() => setSheet(null)} onPlay={playFortune} />}
      <Sheet visible={sheet === 'log'} onClose={() => setSheet(null)} title="Island log">
        {g.log.length === 0 ? (
          <Text color={theme.color.inkSoft}>Nothing has happened yet this session. Moves will appear here as they land.</Text>
        ) : (
          [...g.log]
            .reverse()
            .map((e) => ({ key: `${e.seq}-${e.idx}`, text: describeEvent(e.event, names, me) }))
            .filter((x) => x.text)
            .slice(0, 120)
            .map((x) => (
              <Text key={x.key} style={{ paddingVertical: 2 }}>
                {x.text}
              </Text>
            ))
        )}
      </Sheet>
      {owedDiscard !== undefined && <DiscardSheet view={view} owed={owedDiscard} busy={g.busy} onDiscard={(cards) => submit({ type: 'discard', cards })} />}
      <StealSheet
        visible={stealHex !== null}
        victims={stealHex !== null && me !== null ? raiderVictims(view, me, stealHex, (s) => view.players[s].handCount) : []}
        view={view}
        seats={seats}
        onClose={() => {
          setStealHex(null);
          setSelected(null);
        }}
        onPick={async (victim) => {
          const hex = stealHex!;
          setStealHex(null);
          await submit({ type: 'moveRaider', hex, victim });
        }}
      />
      {phase.kind === 'ended' && !winDismissed && !g.replay && (
        <WinOverlay
          view={view}
          seats={seats}
          onHome={() => {
            setWinDismissed(true);
            onExit();
          }}
          onRematch={onRematch}
        />
      )}
    </Screen>
  );
}

