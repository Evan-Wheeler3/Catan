import { Tabs } from 'expo-router';
import { Icon } from '../../src/ui/icons';
import { useTheme } from '../../src/theme/settings';
import { fonts } from '../../src/theme/tokens';

export default function TabsLayout() {
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.ink,
        tabBarInactiveTintColor: theme.color.inkFaint,
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 12 },
        tabBarStyle: { backgroundColor: theme.color.surface, borderTopWidth: 2, borderTopColor: theme.color.outline, height: 84, paddingTop: 6 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Games', tabBarIcon: ({ focused }) => <Icon name="island" size={28} fill={focused ? theme.color.primary : theme.color.surfaceAlt} /> }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends', tabBarIcon: ({ focused }) => <Icon name="friends" size={28} fill={focused ? theme.color.primary : theme.color.surfaceAlt} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'You', tabBarIcon: ({ focused }) => <Icon name="gear" size={28} fill={focused ? theme.color.primary : theme.color.surfaceAlt} /> }} />
    </Tabs>
  );
}
