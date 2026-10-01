// Registers this device for push and routes notification taps into the right game.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { supabase } from './supabase';

if (Platform.OS !== 'web') Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: true }),
});

export async function registerForPush(userId: string): Promise<string | null> {
  if (!supabase || !Device.isDevice || Platform.OS === 'web') return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('turns', {
      name: 'Turns & trades',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#1BA3A0',
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  const status = existing === 'granted' ? existing : (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId || undefined;
  try {
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await supabase.from('push_tokens').upsert({ user_id: userId, token, platform: Platform.OS as 'ios' | 'android', updated_at: new Date().toISOString() });
    return token;
  } catch {
    return null; // Missing push credentials in dev builds — the game still works without push.
  }
}

/** Opens the game when a notification is tapped (including cold starts). */
export function useNotificationRouting() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (data: Record<string, unknown> | undefined) => {
      if (typeof data?.gameId === 'string') router.push(`/game/${data.gameId}`);
    };
    Notifications.getLastNotificationResponseAsync().then((r) => r && open(r.notification.request.content.data));
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
    return () => sub.remove();
  }, []);
}
