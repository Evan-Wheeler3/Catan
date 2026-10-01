// Haptics + optional sound, both gated by user settings.
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';
import { useSettings } from '../theme/settings';

const SOUNDS = {
  dice: require('../../assets/sounds/dice.wav'),
  place: require('../../assets/sounds/place.wav'),
  card: require('../../assets/sounds/card.wav'),
  win: require('../../assets/sounds/win.wav'),
} as const;
export type SoundName = keyof typeof SOUNDS;

export function useFeedback() {
  const { settings } = useSettings();
  const players = useRef<Partial<Record<SoundName, AudioPlayer>>>({});

  useEffect(() => {
    const current = players.current;
    return () => {
      for (const p of Object.values(current)) p?.remove();
    };
  }, []);

  const tap = useCallback(() => {
    if (settings.haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [settings.haptics]);

  const thunk = useCallback(() => {
    if (settings.haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [settings.haptics]);

  const success = useCallback(() => {
    if (settings.haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [settings.haptics]);

  const warn = useCallback(() => {
    if (settings.haptics) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, [settings.haptics]);

  const play = useCallback(
    (name: SoundName) => {
      if (!settings.sound) return;
      try {
        let p = players.current[name];
        if (!p) {
          p = createAudioPlayer(SOUNDS[name]);
          players.current[name] = p;
        }
        p.seekTo(0);
        p.play();
      } catch {
        // Sound is decorative; never let it break the game.
      }
    },
    [settings.sound],
  );

  return { tap, thunk, success, warn, play };
}
