import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/data/auth';
import { Field } from '../src/ui/Field';
import { HeroIsland } from '../src/ui/Hero';
import { Banner, Button, Screen, Text } from '../src/ui/primitives';
import { useTheme } from '../src/theme/settings';
import { space } from '../src/theme/tokens';

export default function SignIn() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'start' | 'code'>('start');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<string | null>, after?: () => void) => {
    setBusy(key);
    setError(null);
    const err = await fn();
    setBusy(null);
    if (err) setError(err);
    else after?.();
  };
  const done = () => router.replace('/');

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: space.sm }}>
            <HeroIsland />
            <Text variant="display" accessibilityRole="header">
              Tideholm
            </Text>
            <Text color={theme.color.inkSoft} style={{ textAlign: 'center' }}>
              Settle a tiny island with friends — one unhurried turn at a time.
            </Text>
          </View>
          {error && <Banner text={error} onDismiss={() => setError(null)} />}
          {step === 'start' ? (
            <>
              {Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={theme.dark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={18}
                  style={{ height: 54 }}
                  onPress={() => run('apple', auth.signInWithApple, done)}
                />
              )}
              <Button tone="plain" label="Continue with Google" loading={busy === 'google'} onPress={() => run('google', auth.signInWithGoogle, done)} />
              <Text variant="caption" color={theme.color.inkSoft} style={{ textAlign: 'center' }}>
                or use a one-time code
              </Text>
              <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" />
              <Button
                tone="secondary"
                label="Email me a code"
                disabled={!/^\S+@\S+\.\S+$/.test(email)}
                loading={busy === 'email'}
                onPress={() => run('email', () => auth.sendEmailCode(email), () => setStep('code'))}
              />
            </>
          ) : (
            <>
              <Text>We sent a 6-digit code to {email}. It may take a minute to wash ashore.</Text>
              <Field label="Code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} placeholder="123456" />
              <Button label="Sign in" disabled={code.length < 6} loading={busy === 'verify'} onPress={() => run('verify', () => auth.verifyEmailCode(email, code), done)} />
              <Button tone="plain" label="Use a different email" onPress={() => setStep('start')} />
            </>
          )}
          <Button tone="plain" small label="Just practice offline" onPress={() => router.push('/practice')} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
