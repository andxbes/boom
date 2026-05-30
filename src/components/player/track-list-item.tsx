import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Track } from '@/types/profile';

type TrackListItemProps = {
  track: Track;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  onPress: () => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

export function TrackListItem({
  track,
  index,
  isActive,
  isPlaying,
  onPress,
  onRemove,
  onMoveUp,
  onMoveDown,
}: TrackListItemProps) {
  const theme = useTheme();

  return (
    <Pressable onPress={onPress}>
      <ThemedView
        type={isActive ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.container}>
        <View style={styles.main}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {index + 1}
          </ThemedText>
          <View style={styles.texts}>
            <ThemedText type="smallBold" numberOfLines={1}>
              {isActive && isPlaying ? '▶ ' : ''}
              {track.name}
            </ThemedText>
          </View>
        </View>
        <View style={styles.actions}>
          {onMoveUp ? (
            <IconButton label="↑" onPress={onMoveUp} color={theme.textSecondary} />
          ) : null}
          {onMoveDown ? (
            <IconButton label="↓" onPress={onMoveDown} color={theme.textSecondary} />
          ) : null}
          <IconButton label="✕" onPress={onRemove} color="#e5484d" />
        </View>
      </ThemedView>
    </Pressable>
  );
}

function IconButton({
  label,
  onPress,
  color,
}: {
  label: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.iconButton}>
      <ThemedText style={{ color }} type="smallBold">
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  texts: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  iconButton: {
    padding: Spacing.one,
  },
});
