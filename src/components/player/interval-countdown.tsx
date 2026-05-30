import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type IntervalCountdownProps = {
  secondsLeft: number;
  totalSeconds: number;
};

export function IntervalCountdown({ secondsLeft, totalSeconds }: IntervalCountdownProps) {
  if (totalSeconds <= 0) {
    return null;
  }

  const progress = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;

  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      <ThemedText type="smallBold">Пауза между треками</ThemedText>
      <ThemedText type="title" style={styles.timer}>
        {secondsLeft}с
      </ThemedText>
      <ThemedText themeColor="textSecondary" type="small">
        Случайная задержка до {totalSeconds} сек
      </ThemedText>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    borderRadius: Spacing.three,
    padding: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
  },
  timer: {
    fontSize: 40,
    lineHeight: 44,
  },
  track: {
    alignSelf: 'stretch',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(128,128,128,0.25)',
    marginTop: Spacing.two,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#3c87f7',
    borderRadius: 3,
  },
});
