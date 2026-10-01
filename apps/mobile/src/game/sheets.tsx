// Bottom sheets for building, trading, Fortune cards, discarding and stealing.
import {
  COSTS,
  FORTUNE_LABEL,
  FORTUNE_TEXT,
  RESOURCES,
  RESOURCE_LABEL,
  counts,
  harborRates,
  hasCards,
  totalCards,
  validOutposts,
  validTowns,
  validTrails,
  type FortuneKind,
  type PlayerView,
  type Resource,
  type ResourceCounts,
  type Seat,
  type TradeOffer,
} from '@tideholm/engine';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { SeatInfo } from '../data/connection';
import { Avatar } from '../ui/Avatar';
import { FORTUNE_ICON, Icon, ResourceIcon } from '../ui/icons';
import { Button, Card, Chip, Text } from '../ui/primitives';
import { Sheet } from '../ui/Sheet';
import { useTheme } from '../theme/settings';
import { radius, seatStyles, space } from '../theme/tokens';

export type BuildKind = 'trail' | 'outpost' | 'town';

function CostRow({ cost }: { cost: Partial<ResourceCounts> }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
      {RESOURCES.flatMap((r) => Array.from({ length: cost[r] ?? 0 }, (_, i) => <ResourceIcon key={`${r}${i}`} resource={r} size={20} />))}
    </View>
  );
}

function Stepper({
  resource,
  value,
  max,
  onChange,
  compact,
  label,
}: {
  resource: Resource;
  value: number;
  max: number;
  onChange: (v: number) => void;
  compact?: boolean;
  label?: string;
}) {
  const theme = useTheme();
  const d = compact ? 34 : 40;
  const btn = (kind: 'Add' | 'Remove', delta: number, disabled: boolean) => (
    <Pressable
      onPress={() => onChange(value + delta)}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={`${kind} ${label ? `${label} ` : ''}${RESOURCE_LABEL[resource]}`}
      style={{
        width: d,
        height: d,
        borderRadius: 0,
        borderWidth: 2,
        borderColor: theme.dark ? theme.color.inkFaint : theme.color.outline,
        backgroundColor: disabled ? theme.color.surfaceAlt : theme.color.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text variant="number">{kind === 'Add' ? '+' : '−'}</Text>
    </Pressable>
  );
  const controls = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {btn('Remove', -1, value <= 0)}
      <Text variant="number" style={{ minWidth: 22, textAlign: 'center' }} accessibilityLabel={`${value} ${label ?? ''} selected`}>
        {value}
      </Text>
      {btn('Add', 1, value >= max)}
    </View>
  );
  if (compact) return controls;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <ResourceIcon resource={resource} size={28} />
      <Text variant="label" style={{ flex: 1 }}>
        {RESOURCE_LABEL[resource]}
      </Text>
      {controls}
    </View>
  );
}

function ResourcePicker({ value, onChange, disabled }: { value: Resource | null; onChange: (r: Resource) => void; disabled?: (r: Resource) => boolean }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {RESOURCES.map((r) => {
        const off = disabled?.(r);
        const on = value === r;
        return (
          <Pressable
            key={r}
            disabled={off}
            onPress={() => onChange(r)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: off }}
            accessibilityLabel={RESOURCE_LABEL[r]}
            style={{
              alignItems: 'center',
              padding: space.sm,
              minWidth: 60,
              borderRadius: radius.chip,
              borderWidth: on ? 3 : 2,
              borderColor: on ? theme.color.secondary : theme.color.outline,
              backgroundColor: on ? theme.color.surfaceAlt : theme.color.surface,
              opacity: off ? 0.35 : 1,
            }}
          >
            <ResourceIcon resource={r} size={28} />
            <Text variant="caption">{RESOURCE_LABEL[r]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------

export function BuildSheet({
  visible,
  onClose,
  view,
  onPick,
  onBuyFortune,
}: {
  visible: boolean;
  onClose: () => void;
  view: PlayerView;
  onPick: (k: BuildKind) => void;
  onBuyFortune: () => void;
}) {
  const theme = useTheme();
  const me = view.players[view.viewer!];
  const hand = me.hand!;
  const options: { kind: BuildKind | 'fortune'; title: string; blurb: string; cost: ResourceCounts; reason: string | null }[] = [
    {
      kind: 'trail',
      title: 'Trail',
      blurb: 'Connect your pieces and reach new spots.',
      cost: COSTS.trail,
      reason: me.trailsLeft <= 0 ? 'All 15 trails placed' : validTrails(view, me.seat).length === 0 ? 'No open edges next to your pieces' : null,
    },
    {
      kind: 'outpost',
      title: 'Outpost · 1 point',
      blurb: 'Collects from the tiles around it.',
      cost: COSTS.outpost,
      reason: me.outpostsLeft <= 0 ? 'All 5 outposts placed — upgrade one' : validOutposts(view, me.seat).length === 0 ? 'Extend a trail to an open spot first' : null,
    },
    {
      kind: 'town',
      title: 'Town · 2 points',
      blurb: 'Upgrade an outpost to collect double.',
      cost: COSTS.town,
      reason: me.townsLeft <= 0 ? 'All 4 towns built' : validTowns(view, me.seat).length === 0 ? 'You need an outpost to upgrade' : null,
    },
    {
      kind: 'fortune',
      title: 'Fortune card',
      blurb: 'Wardens, windfalls, secret relics…',
      cost: COSTS.fortune,
      reason: view.deckCount === 0 ? 'The Fortune deck is empty' : null,
    },
  ];
  return (
    <Sheet visible={visible} onClose={onClose} title="Build">
      {options.map((o) => {
        const affordable = hasCards(hand, o.cost);
        const blocked = o.reason ?? (affordable ? null : 'Not enough resources yet');
        return (
          <Card
            key={o.kind}
            onPress={blocked ? undefined : () => (o.kind === 'fortune' ? onBuyFortune() : onPick(o.kind as BuildKind))}
            accessibilityLabel={`${o.title}. ${blocked ?? 'Available'}`}
            style={{ opacity: blocked ? 0.55 : 1, gap: 6 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="title">{o.title}</Text>
              <CostRow cost={o.cost} />
            </View>
            <Text variant="caption" color={theme.color.inkSoft}>
              {o.blurb}
            </Text>
            {blocked && <Chip label={blocked} />}
          </Card>
        );
      })}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------

export function TradeSheet({
  visible,
  onClose,
  view,
  seats,
  onOffer,
  onHarbor,
  onCancel,
}: {
  visible: boolean;
  onClose: () => void;
  view: PlayerView;
  seats: SeatInfo[];
  onOffer: (to: Seat[], give: ResourceCounts, get: ResourceCounts) => void;
  onHarbor: (give: Resource, get: Resource) => void;
  onCancel: (offerId: number) => void;
}) {
  const theme = useTheme();
  const me = view.viewer!;
  const hand = view.players[me].hand!;
  const isCurrent = view.currentSeat === me;
  const [tab, setTab] = useState<'players' | 'harbor'>('players');
  const [give, setGive] = useState<ResourceCounts>(counts({}));
  const [get, setGet] = useState<ResourceCounts>(counts({}));
  const others = view.players.filter((p) => p.seat !== me).map((p) => p.seat);
  const allowed = isCurrent ? others : [view.currentSeat];
  const [to, setTo] = useState<Seat[]>(allowed);
  const [hGive, setHGive] = useState<Resource | null>(null);
  const [hGet, setHGet] = useState<Resource | null>(null);
  const rates = useMemo(() => harborRates(view, me), [view, me]);

  useEffect(() => {
    if (visible) {
      setGive(counts({}));
      setGet(counts({}));
      setTo(isCurrent ? others : [view.currentSeat]);
      setHGive(null);
      setHGet(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const myOffers = view.offers.filter((o) => o.from === me);
  const canTradeNow = view.phase.kind === 'main';
  const offerReady = totalCards(give) > 0 && totalCards(get) > 0 && to.length > 0 && canTradeNow;

  return (
    <Sheet visible={visible} onClose={onClose} title="Trade">
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button small tone={tab === 'players' ? 'secondary' : 'plain'} label="With players" onPress={() => setTab('players')} style={{ flex: 1 }} />
        <Button small tone={tab === 'harbor' ? 'secondary' : 'plain'} label="Harbor & bank" onPress={() => setTab('harbor')} style={{ flex: 1 }} disabled={!isCurrent} />
      </View>
      {!canTradeNow && (
        <Chip label={view.phase.kind === 'roll' ? 'Trading opens once the dice are rolled.' : 'Trading is paused until the Raider is dealt with.'} />
      )}

      {tab === 'players' ? (
        <View style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }} />
            <Text variant="label" style={{ width: 120, textAlign: 'center' }}>
              You give
            </Text>
            <Text variant="label" style={{ width: 120, textAlign: 'center' }}>
              You ask for
            </Text>
          </View>
          {RESOURCES.map((r) => (
            <View key={r} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, alignItems: 'flex-start' }}>
                <ResourceIcon resource={r} size={26} />
                <Text variant="caption" numberOfLines={1}>
                  {RESOURCE_LABEL[r]} · {hand[r]}
                </Text>
              </View>
              <View style={{ width: 120, alignItems: 'center' }}>
                <Stepper compact label="give" resource={r} value={give[r]} max={get[r] > 0 ? 0 : hand[r]} onChange={(v) => setGive({ ...give, [r]: v })} />
              </View>
              <View style={{ width: 120, alignItems: 'center' }}>
                <Stepper compact label="ask for" resource={r} value={get[r]} max={give[r] > 0 ? 0 : 9} onChange={(v) => setGet({ ...get, [r]: v })} />
              </View>
            </View>
          ))}
          <Text variant="title">Offer to</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {allowed.map((s) => {
              const on = to.includes(s);
              return (
                <Pressable
                  key={s}
                  onPress={() => setTo(on ? to.filter((x) => x !== s) : [...to, s])}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={seats[s]?.name}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.sm,
                    padding: 6,
                    paddingRight: space.md,
                    borderRadius: radius.pill,
                    borderWidth: on ? 3 : 2,
                    borderColor: on ? theme.color.secondary : theme.color.outline,
                    backgroundColor: on ? theme.color.surfaceAlt : theme.color.surface,
                  }}
                >
                  <Avatar id={seats[s]?.avatar} size={30} ring={seatStyles[s].color} />
                  <Text variant="label">{seats[s]?.name}</Text>
                </Pressable>
              );
            })}
          </View>
          {!isCurrent && <Text variant="caption" color={theme.color.inkSoft}>Every trade has to include the player whose turn it is.</Text>}
          <Button
            label="Send offer"
            icon={<Icon name="trade" size={20} />}
            disabled={!offerReady}
            onPress={() => {
              onOffer(to, give, get);
              setGive(counts({}));
              setGet(counts({}));
            }}
          />
          {myOffers.length > 0 && <Text variant="title">Your open offers</Text>}
          {myOffers.map((o) => (
            <Card key={o.id} style={{ gap: 6 }}>
              <OfferSummary offer={o} seats={seats} viewer={me} />
              <Text variant="caption" color={theme.color.inkSoft}>
                Waiting on {o.to.filter((t) => !o.declined.includes(t)).map((t) => seats[t]?.name).join(', ')}
                {o.declined.length ? ` · declined by ${o.declined.map((t) => seats[t]?.name).join(', ')}` : ''}
              </Text>
              <Button small tone="plain" label="Withdraw" onPress={() => onCancel(o.id)} />
            </Card>
          ))}
        </View>
      ) : (
        <View style={{ gap: space.md }}>
          <Text color={theme.color.inkSoft}>Trade with the bank. Outposts and towns on a harbor get better rates.</Text>
          <Text variant="title">Give</Text>
          <ResourcePicker value={hGive} onChange={setHGive} disabled={(r) => hand[r] < rates[r]} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {RESOURCES.map((r) => (
              <Chip key={r} label={`${RESOURCE_LABEL[r]} ${rates[r]}:1`} color={rates[r] < 4 ? theme.color.secondary : undefined} ink={rates[r] < 4 ? theme.color.onSecondary : undefined} />
            ))}
          </View>
          <Text variant="title">Get</Text>
          <ResourcePicker value={hGet} onChange={setHGet} disabled={(r) => r === hGive || view.bank[r] === 0} />
          <Button
            label={hGive ? `Trade ${rates[hGive]} ${RESOURCE_LABEL[hGive]}${hGet ? ` for 1 ${RESOURCE_LABEL[hGet]}` : ''}` : 'Pick what to give'}
            disabled={!hGive || !hGet || !canTradeNow}
            onPress={() => hGive && hGet && onHarbor(hGive, hGet)}
          />
        </View>
      )}
    </Sheet>
  );
}

export function OfferSummary({ offer, seats, viewer }: { offer: TradeOffer; seats: SeatInfo[]; viewer: Seat | null }) {
  const from = offer.from === viewer ? 'You' : seats[offer.from]?.name;
  return (
    <View style={{ gap: 4 }}>
      <Text variant="label">{from} {offer.from === viewer ? 'give' : 'gives'}</Text>
      <CostRow cost={offer.give} />
      <Text variant="label">{offer.from === viewer ? 'and ask for' : 'and wants'}</Text>
      <CostRow cost={offer.get} />
    </View>
  );
}

// ---------------------------------------------------------------------------

export function FortuneSheet({
  visible,
  onClose,
  view,
  onPlay,
}: {
  visible: boolean;
  onClose: () => void;
  view: PlayerView;
  onPlay: (kind: FortuneKind, extra?: { resources?: [Resource, Resource]; resource?: Resource }) => void;
}) {
  const theme = useTheme();
  const me = view.players[view.viewer!];
  const cards = me.fortune ?? [];
  const [choosing, setChoosing] = useState<FortuneKind | null>(null);
  const [a, setA] = useState<Resource | null>(null);
  const [b, setB] = useState<Resource | null>(null);
  useEffect(() => {
    if (!visible) {
      setChoosing(null);
      setA(null);
      setB(null);
    }
  }, [visible]);

  const reasonFor = (kind: FortuneKind, boughtOnTurn: number): string | null => {
    if (kind === 'relic') return 'Relics score automatically — keep it secret!';
    if (view.currentSeat !== me.seat) return 'Play it on your turn';
    if (view.fortunePlayedThisTurn) return 'One Fortune card per turn';
    if (boughtOnTurn >= view.turn) return 'Fresh card — playable next turn';
    if (kind === 'warden' ? !['roll', 'main'].includes(view.phase.kind) : view.phase.kind !== 'main') {
      return kind === 'warden' ? 'Not right now' : 'Roll the dice first';
    }
    return null;
  };

  if (cards.length === 0) {
    return (
      <Sheet visible={visible} onClose={onClose} title="Fortune cards">
        <Text color={theme.color.inkSoft}>
          You have no Fortune cards yet. Buy one from Build for 1 Fleece, 1 Grain and 1 Stone — you might find a Warden, a Windfall, or a secret Relic.
        </Text>
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Fortune cards">
      {choosing === 'windfall' || choosing === 'embargo' ? (
        <View style={{ gap: space.md }}>
          <Text variant="title">{choosing === 'windfall' ? 'Take any two resources' : 'Name a resource to embargo'}</Text>
          <ResourcePicker value={a} onChange={setA} disabled={(r) => choosing === 'windfall' && view.bank[r] === 0} />
          {choosing === 'windfall' && (
            <>
              <Text variant="label">Second resource</Text>
              <ResourcePicker value={b} onChange={setB} disabled={(r) => view.bank[r] - (r === a ? 1 : 0) <= 0} />
            </>
          )}
          <Button
            label={`Play ${FORTUNE_LABEL[choosing]}`}
            disabled={!a || (choosing === 'windfall' && !b)}
            onPress={() => onPlay(choosing, choosing === 'windfall' ? { resources: [a!, b!] } : { resource: a! })}
          />
          <Button tone="plain" label="Back" onPress={() => setChoosing(null)} />
        </View>
      ) : (
        cards.map((c) => {
          const reason = reasonFor(c.kind, c.boughtOnTurn);
          return (
            <Card key={c.id} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <View style={{ width: 52, height: 70, borderRadius: 0, borderWidth: 2, borderColor: theme.color.outline, backgroundColor: theme.color.secondary, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={FORTUNE_ICON[c.kind]} size={30} fill={theme.color.primary} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="title">{FORTUNE_LABEL[c.kind]}</Text>
                <Text variant="caption" color={theme.color.inkSoft}>
                  {FORTUNE_TEXT[c.kind]}
                </Text>
                {reason ? (
                  <Chip label={reason} />
                ) : (
                  <Button
                    small
                    label="Play"
                    onPress={() => (c.kind === 'windfall' || c.kind === 'embargo' ? setChoosing(c.kind) : onPlay(c.kind))}
                    style={{ alignSelf: 'flex-start' }}
                  />
                )}
              </View>
            </Card>
          );
        })
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------

export function DiscardSheet({ view, owed, onDiscard, busy }: { view: PlayerView; owed: number; onDiscard: (c: ResourceCounts) => void; busy: boolean }) {
  const theme = useTheme();
  const hand = view.players[view.viewer!].hand!;
  const [pick, setPick] = useState<ResourceCounts>(counts({}));
  const chosen = totalCards(pick);
  return (
    <Sheet visible onClose={() => {}} title="The Raider strikes!" dismissable={false}>
      <Text color={theme.color.inkSoft}>
        You're holding more than 7 cards. Choose {owed} to give back to the bank.
      </Text>
      {RESOURCES.filter((r) => hand[r] > 0).map((r) => (
        <Stepper key={r} resource={r} value={pick[r]} max={Math.min(hand[r], pick[r] + owed - chosen)} onChange={(v) => setPick({ ...pick, [r]: v })} />
      ))}
      <Button label={chosen === owed ? `Discard ${owed} cards` : `Choose ${owed - chosen} more`} disabled={chosen !== owed} loading={busy} onPress={() => onDiscard(pick)} />
    </Sheet>
  );
}

export function StealSheet({
  visible,
  victims,
  view,
  seats,
  onPick,
  onClose,
}: {
  visible: boolean;
  victims: Seat[];
  view: PlayerView;
  seats: SeatInfo[];
  onPick: (s: Seat) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Who do you raid?">
      {victims.map((s) => (
        <Card key={s} onPress={() => onPick(s)} accessibilityLabel={`Steal from ${seats[s]?.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Avatar id={seats[s]?.avatar} size={44} ring={seatStyles[s].color} />
          <View style={{ flex: 1 }}>
            <Text variant="title">{seats[s]?.name}</Text>
            <Text variant="caption">{view.players[s].handCount} cards in hand</Text>
          </View>
          <Icon name="hammer" />
        </Card>
      ))}
    </Sheet>
  );
}
