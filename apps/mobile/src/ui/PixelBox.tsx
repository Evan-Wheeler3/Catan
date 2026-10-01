// Chunky 16-bit panels: a notched (stepped-corner) outline, a flat face and a solid "lip"
// underneath. Built from overlapping Views, so it needs no measuring and stays crisp.
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

function Notched({ color, inset, top, bottom, step }: { color: string; inset: number; top: number; bottom: number; step: number }) {
  return (
    <>
      <View style={{ position: 'absolute', left: inset + step, right: inset + step, top: top + inset, bottom: bottom + inset, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: inset, right: inset, top: top + inset + step, bottom: bottom + inset + step, backgroundColor: color }} />
    </>
  );
}

export function PixelBox({
  face,
  border,
  lip,
  lipHeight = 4,
  u = 3,
  shine,
  children,
  style,
  contentStyle,
}: {
  face: string;
  border: string;
  lip?: string;
  lipHeight?: number;
  /** Border thickness and corner step, in points. */
  u?: number;
  /** Optional 1-step highlight along the top edge for a bevelled look. */
  shine?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const lh = lip ? lipHeight : 0;
  return (
    <View style={[{ paddingBottom: lh }, style]}>
      {/* Outline around everything, then the lip (thickness), then the face on top. */}
      <Notched color={border} inset={0} top={0} bottom={0} step={u} />
      {lip ? <Notched color={lip} inset={u} top={0} bottom={0} step={u} /> : null}
      <Notched color={face} inset={u} top={0} bottom={lh} step={u} />
      {shine ? <View style={{ position: 'absolute', left: u * 2, right: u * 3, top: u, height: u, backgroundColor: shine }} /> : null}
      <View style={[{ padding: u }, contentStyle]}>{children}</View>
    </View>
  );
}
