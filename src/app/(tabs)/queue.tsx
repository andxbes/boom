import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { TrackListItem } from '@/components/player/track-list-item';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';

export default function QueueScreen() {
  const {
    isReady,
    activeProfile,
    currentTrack,
    isPlaying,
    pickAndAddTracks,
    removeTrack,
    moveTrack,
    playTrackAt,
  } = useApp();
  const theme = useTheme();

  if (!isReady || !activeProfile) {
    return (
      <ScreenShell>
        <ThemedView style={styles.centered}>
          <ActivityIndicator />
        </ThemedView>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedView style={styles.header}>
          <ThemedText type="subtitle">Очередь</ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            Профиль: {activeProfile.name}
          </ThemedText>
        </ThemedView>

        <Pressable
          onPress={pickAndAddTracks}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: theme.backgroundSelected },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="smallBold">+ Добавить аудиофайлы</ThemedText>
        </Pressable>

        {activeProfile.tracks.length === 0 ? (
          <ThemedView type="backgroundElement" style={styles.empty}>
            <ThemedText themeColor="textSecondary">
              Очередь пуста. Добавьте mp3, wav, flac и другие аудиофайлы с устройства.
            </ThemedText>
          </ThemedView>
        ) : (
          activeProfile.tracks.map((track, index) => (
            <TrackListItem
              key={track.id}
              track={track}
              index={index}
              isActive={currentTrack?.id === track.id}
              isPlaying={isPlaying}
              onPress={() => playTrackAt(index)}
              onRemove={() => removeTrack(track.id)}
              onMoveUp={index > 0 ? () => moveTrack(index, index - 1) : undefined}
              onMoveDown={
                index < activeProfile.tracks.length - 1
                  ? () => moveTrack(index, index + 1)
                  : undefined
              }
            />
          ))
        )}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: Spacing.three,
    paddingBottom: Spacing.four,
  },
  header: {
    gap: Spacing.one,
  },
  addButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  empty: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
  },
  pressed: {
    opacity: 0.75,
  },
});
