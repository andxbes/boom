import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useScreenInsets } from '@/constants/layout';

type ScreenShellProps = {
  children: ReactNode;
  footer?: ReactNode;
  style?: ViewStyle;
};

export function ScreenShell({ children, footer, style }: ScreenShellProps) {
  const { top, bottom } = useScreenInsets();

  return (
    <ThemedView style={[styles.container, style]}>
      <View style={[styles.body, { paddingTop: top, paddingBottom: footer ? 0 : bottom }]}>
        {children}
      </View>
      {footer ? <View style={[styles.footer, { paddingBottom: bottom }]}>{footer}</View> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
});
