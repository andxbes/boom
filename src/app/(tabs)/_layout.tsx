import { type ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_CONTENT_HEIGHT } from '@/constants/layout';
import { Colors, Spacing } from '@/constants/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IoniconName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabLayout() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const insets = useSafeAreaInsets();
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, Spacing.two);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.backgroundElement,
          borderTopWidth: 0,
          height: tabBarHeight,
          paddingTop: Spacing.two,
          paddingBottom: Math.max(insets.bottom, Spacing.two),
          paddingHorizontal: Spacing.two,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Плеер',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="play-circle-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: 'Очередь',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="list-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Настройки',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="options-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profiles"
        options={{
          title: 'Профили',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="people-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
