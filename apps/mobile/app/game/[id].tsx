import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useAuth } from '../../src/data/auth';
import { newPracticeGame, onlineConnection, practiceConnection } from '../../src/data/connection';
import { supabase } from '../../src/data/supabase';
import { GameScreen } from '../../src/game/GameScreen';

export default function Game() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const conn = useMemo(() => (id === 'practice' ? practiceConnection() : onlineConnection(id!)), [id]);
  const exit = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  const rematch =
    id === 'practice'
      ? async () => {
          await newPracticeGame(2, profile?.username ?? 'You', profile?.avatar ?? 'gull');
          router.replace('/game/practice');
        }
      : async () => {
          if (!supabase) return;
          const { data: seats } = await supabase.from('game_players').select('user_id').eq('game_id', id).neq('status', 'declined');
          const { data: game } = await supabase.from('games').select('name, turn_timer_hours').eq('id', id).single();
          const me = (await supabase.auth.getUser()).data.user?.id;
          const { data } = await supabase.rpc('create_game', {
            invitees: (seats ?? []).map((s) => s.user_id).filter((u) => u !== me),
            timer_hours: game?.turn_timer_hours ?? null,
            game_name: `${game?.name ?? 'Island'} — rematch`,
          });
          if (data) router.replace(`/lobby/${data}`);
        };

  return <GameScreen key={id} conn={conn} onExit={exit} onRematch={rematch} />;
}
