import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type Theme } from './tokens';

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  reduceMotion: 'system' | 'on' | 'off';
  haptics: boolean;
  sound: boolean;
}

const DEFAULTS: Settings = { theme: 'system', reduceMotion: 'system', haptics: true, sound: false };
const KEY = 'tideholm.settings.v1';

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  theme: Theme;
  reduceMotion: boolean;
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [systemReduce, setSystemReduce] = useState(false);
  const scheme = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && setSettings({ ...DEFAULTS, ...JSON.parse(raw) }))
      .catch(() => {});
    AccessibilityInfo.isReduceMotionEnabled().then(setSystemReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduce);
    return () => sub.remove();
  }, []);

  const value = useMemo<Ctx>(() => {
    const dark = settings.theme === 'system' ? scheme === 'dark' : settings.theme === 'dark';
    return {
      settings,
      update: (patch) =>
        setSettings((prev) => {
          const next = { ...prev, ...patch };
          AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
          return next;
        }),
      theme: dark ? darkTheme : lightTheme,
      reduceMotion: settings.reduceMotion === 'system' ? systemReduce : settings.reduceMotion === 'on',
    };
  }, [settings, scheme, systemReduce]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings outside SettingsProvider');
  return ctx;
}

export const useTheme = () => useSettings().theme;
