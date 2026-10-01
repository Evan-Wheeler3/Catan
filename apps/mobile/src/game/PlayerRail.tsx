import type { PlayerView } from '@tideholm/engine';
import { ScrollView, View } from 'react-native';
import Svg from 'react-native-svg';
import type { SeatInfo } from '../data/connection';
import { Crest } from '../board/Pieces';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/icons';
import { Text } from '../ui/primitives';
import { useTheme } from '../theme/settings';
import { radius, seatStyles, space } from '../theme/tokens';

export function SeatCrest({ seat, size = 14 }: { seat: number; size?: number }) {
  const st = seatStyles[seat];
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Crest shape={st.crest} x={7} y={7.4} r={5} fill={st.color} />
    </Svg>
  );
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
          <View
            key={p.seat}
            accessibilityLabel={`${me ? 'You' : info?.name}: ${vp} points, ${p.handCount} cards, ${p.fortuneCount} fortune cards${view.longestTrail.holder === p.seat ? ', holds Longest Trail' : ''}${view.grandWatch.holder === p.seat ? ', holds Grand Watch' : ''}${current ? ', current turn' : ''}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              paddingVertical: 6,
              paddingLeft: 6,
              paddingRight: space.md,
              borderRadius: radius.pill,
              backgroundColor: current ? theme.color.primary : theme.color.surface,
              borderWidth: 2,
              borderColor: theme.color.outline,
              borderBottomWidth: current ? 4 : 2,
            }}
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
                  {vp}★
                </Text>
                <View style={{ width: 9, height: 12, borderRadius: 2, borderWidth: 1.5, borderColor: theme.color.outline, backgroundColor: theme.color.surfaceAlt }} />
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
        );
      })}
    </ScrollView>
  );
}
