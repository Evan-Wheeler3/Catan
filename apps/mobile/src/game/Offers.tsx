import { hasCards, type PlayerView, type TradeOffer } from '@tideholm/engine';
import { ScrollView, View } from 'react-native';
import type { SeatInfo } from '../data/connection';
import { Avatar } from '../ui/Avatar';
import { Button, Text } from '../ui/primitives';
import { useTheme } from '../theme/settings';
import { seatStyles, space } from '../theme/tokens';
import { PixelBox } from '../ui/PixelBox';
import { OfferSummary } from './sheets';

/** Incoming trade offers, shown as cards above the hand until answered. */
export function IncomingOffers({
  view,
  seats,
  onRespond,
  busy,
}: {
  view: PlayerView;
  seats: SeatInfo[];
  onRespond: (offer: TradeOffer, accept: boolean) => void;
  busy: boolean;
}) {
  const theme = useTheme();
  const me = view.viewer;
  const incoming = view.offers.filter((o) => me !== null && o.to.includes(me) && !o.declined.includes(me));
  if (!incoming.length || me === null) return null;
  const hand = view.players[me].hand!;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.md }}>
      {incoming.map((o) => {
        const canPay = hasCards(hand, o.get);
        const canAccept = canPay && view.phase.kind === 'main';
        return (
          <PixelBox key={o.id} face={theme.color.surface} border={theme.color.outline} lip={theme.color.cardLip} lipHeight={5} style={{ width: 250 }} contentStyle={{ padding: space.md, gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Avatar id={seats[o.from]?.avatar} size={28} ring={seatStyles[o.from].color} />
              <Text variant="label" style={{ flex: 1 }}>
                Trade offer
              </Text>
            </View>
            <OfferSummary offer={o} seats={seats} viewer={me} />
            {!canPay && (
              <Text variant="caption" color={theme.color.danger}>
                You don't have what they're asking for.
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button small tone="plain" label="Decline" onPress={() => onRespond(o, false)} style={{ flex: 1 }} disabled={busy} />
              <Button small tone="secondary" label="Accept" onPress={() => onRespond(o, true)} style={{ flex: 1 }} disabled={!canAccept || busy} />
            </View>
          </PixelBox>
        );
      })}
    </ScrollView>
  );
}
