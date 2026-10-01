import type { PlayerView } from '@tideholm/engine';
import { ScrollView, View } from 'react-native';
import type { SeatInfo } from '../data/connection';
import { PixelCrest } from '../board/Pieces';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/icons';
import { Text } from '../ui/primitives';
import { useTheme } from '../theme/settings';
import { seatStyles, space } from '../theme/tokens';
import { PixelBox } from '../ui/PixelBox';

export function SeatCrest({ seat, size = 14 }: { seat: number; size?: number }) {
  return <PixelCrest seat={seat} size={size} />;
}

/** Compact scoreboard across the top: avatar ringed in seat color, crest, VP, cards, awards. */
export function PlayerRail({ view, seats }: { view: PlayerView; seats: SeatInfo[] }) {
  const theme = useTheme();
  const discarding = view.phase.kind === 'discard' ? view.phase.pending : {};
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.md, gap: space.sm }}>
      {view.players.map((p) => {
        const info = seats[p.seat];
        const current = view.currentSeat === p.seat && view.phase.kind !== 'ended';
        const me = p.seat === view.viewer;
        const vp = me && p.totalVP !== null ? p.totalVP : p.publicVP;
        const status = discarding[p.seat] !== undefined ? 'Discarding' : current ? 'Their turn' : null;
        return (
          <PixelBox
            key={p.seat}
            face={current ? theme.color.primary : theme.color.surface}
            border={theme.color.outline}
            lip={current ? theme.color.primaryLip : theme.color.cardLip}
            lipHeight={current ? 5 : 3}
            contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4, paddingLeft: 5, paddingRight: space.md }}
          >
            <View
              accessible
              accessibilityLabel={`${me ? 'You' : info?.name}: ${vp} points, ${p.handCount} cards, ${p.fortuneCount} fortune cards${view.longestTrail.holder === p.seat ? ', holds Longest Trail' : ''}${view.grandWatch.holder === p.seat ? ', holds Grand Watch' : ''}${current ? ', current turn' : ''}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
            >
            <Avatar id={info?.avatar} size={34} ring={seatStyles[p.seat].color} />
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <SeatCrest seat={p.seat} />
                <Text variant="label" color={current ? theme.color.onPrimary : theme.color.ink} numberOfLines={1} style={{ maxWidth: 92 }}>
                  {me ? 'You' : info?.name}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text variant="number" color={current ? theme.color.onPrimary : theme.color.ink} style={{ fontSize: 15 }}>
                  {vp} VP
                </Text>
                <View style={{ width: 9, height: 12, borderWidth: 2, borderColor: theme.color.outline, backgroundColor: theme.color.surfaceAlt }} />
                <Text variant="caption" color={current ? theme.color.onPrimary : theme.color.inkSoft}>
                  {p.handCount}
                </Text>
                <Icon name="fortune" size={13} />
                <Text variant="caption" color={current ? theme.color.onPrimary : theme.color.inkSoft}>
                  {p.fortuneCount}
                </Text>
                {view.longestTrail.holder === p.seat && <Icon name="trail" size={14} />}
                {view.grandWatch.holder === p.seat && <Icon name="shield" size={14} />}
              </View>
              {status && !current && (
                <Text variant="caption" color={theme.color.danger} style={{ fontSize: 11, lineHeight: 13 }}>
                  {status}
                </Text>
              )}
            </View>
            </View>
          </PixelBox>
        );
      })}
    </ScrollView>
  );
}
