import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';

export const TAB_BAR_CONTENT_HEIGHT = 52;

export function useScreenInsets() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, Spacing.two) + Spacing.two;

  return {
    top: insets.top + Spacing.two,
    bottom: tabBarHeight + Spacing.two,
    tabBarHeight,
    safeBottom: insets.bottom,
  };
}
