import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppProvider } from '@/context/app-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AnimatedSplashOverlay />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AppProvider>
    </SafeAreaProvider>
  );
}
