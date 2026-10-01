import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/data/auth';
import { inviteUrl, myInviteCode, removeFriend, respondFriend, sendFriendRequest, useFriends } from '../../src/data/social';
import { Avatar } from '../../src/ui/Avatar';
import { EmptyState } from '../../src/ui/EmptyState';
import { Field } from '../../src/ui/Field';
import { Icon } from '../../src/ui/icons';
import { Banner, Button, Card, Chip, Screen, SectionHeader, Text } from '../../src/ui/primitives';
import { useTheme } from '../../src/theme/settings';
import { space } from '../../src/theme/tokens';

export default function Friends() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { online } = useAuth();
  const { friends, loading, error, reload } = useFriends();
  const [name, setName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    myInviteCode().then(setCode);
  }, []);

  if (!online) {
    return (
      <Screen style={{ paddingTop: insets.top, justifyContent: 'center' }}>
        <EmptyState title="Friends need a harbor" body="Online play isn't configured on this build, so there's nobody to add yet. Practice mode works offline." />
      </Screen>
    );
  }

  const incoming = friends.filter((f) => f.status === 'incoming');
  const outgoing = friends.filter((f) => f.status === 'outgoing');
  const accepted = friends.filter((f) => f.status === 'accepted');

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingHorizontal: space.lg, paddingBottom: space.xxxl, gap: space.md }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={reload} tintColor={theme.color.secondary} />}
      >
        <Text variant="heading" accessibilityRole="header">
          Your crew
        </Text>
        <Field label="Add by username" value={name} onChangeText={setName} autoCapitalize="none" autoCorrect={false} placeholder="their_username" returnKeyType="send" />
        <Button
          tone="secondary"
          label="Send friend request"
          loading={busy}
          disabled={name.trim().length < 3}
          onPress={async () => {
            setBusy(true);
            setMessage(await sendFriendRequest(name));
            setBusy(false);
            setName('');
            reload();
          }}
        />
        {message && <Banner tone="info" text={message} onDismiss={() => setMessage(null)} />}
        <Card style={{ gap: space.sm }}>
          <Text variant="title">Invite with a link</Text>
          <Text variant="caption" color={theme.color.inkSoft}>
            Anyone who opens your link becomes your friend instantly.
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button
              small
              label="Share link"
              icon={<Icon name="share" size={18} />}
              disabled={!code}
              onPress={() => code && Share.share({ message: `Come settle an island with me in Tideholm! ${inviteUrl(code)}` })}
              style={{ flex: 1 }}
            />
            <Button
              small
              tone="plain"
              label="Copy"
              disabled={!code}
              onPress={async () => {
                if (!code) return;
                await Clipboard.setStringAsync(inviteUrl(code));
                setMessage('Invite link copied.');
              }}
              style={{ flex: 1 }}
            />
          </View>
        </Card>

        {error && <EmptyState tone="storm" title="Couldn't load friends" body={error} action={<Button small tone="plain" label="Try again" onPress={reload} />} />}

        {incoming.length > 0 && <SectionHeader title="Requests" count={incoming.length} />}
        {incoming.map((f) => (
          <Card key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Avatar id={f.avatar} size={44} />
            <Text variant="label" style={{ flex: 1 }}>
              {f.username}
            </Text>
            <Button small tone="plain" label="Decline" onPress={() => respondFriend(f.id, false).then(reload)} />
            <Button small tone="secondary" label="Accept" onPress={() => respondFriend(f.id, true).then(reload)} />
          </Card>
        ))}

        {accepted.length > 0 && <SectionHeader title="Friends" count={accepted.length} />}
        {accepted.map((f) => (
          <Card
            key={f.id}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
            onPress={() =>
              Alert.alert(f.username, undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove friend', style: 'destructive', onPress: () => removeFriend(f.id).then(reload) },
              ])
            }
            accessibilityLabel={`${f.username}. Tap for options.`}
          >
            <Avatar id={f.avatar} size={44} />
            <Text variant="label" style={{ flex: 1 }}>
              {f.username}
            </Text>
          </Card>
        ))}

        {outgoing.length > 0 && <SectionHeader title="Sent" />}
        {outgoing.map((f) => (
          <Card key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Avatar id={f.avatar} size={36} />
            <Text style={{ flex: 1 }}>{f.username}</Text>
            <Chip label="Pending" />
          </Card>
        ))}

        {!loading && !error && friends.length === 0 && (
          <EmptyState title="No crewmates yet" body="Add a friend by username or share your invite link. You'll need two or three friends to start an island." />
        )}
      </ScrollView>
    </Screen>
  );
}
