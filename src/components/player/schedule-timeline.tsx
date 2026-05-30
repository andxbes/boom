import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PlayerPhase } from '@/services/queue';
import type { ScheduleRow } from '@/services/schedule';
import { toTimelineTracks } from '@/services/schedule';
import type { Track } from '@/types/profile';
import { formatClockTime } from '@/utils/time';

type ScheduleTimelineProps = {
  rows: ScheduleRow[];
  phase: PlayerPhase;
  playOrder: number[];
  tracks: Track[];
  onTrackPress?: (orderIndex: number) => void;
};

export function ScheduleTimeline({
  rows,
  phase,
  playOrder,
  tracks,
  onTrackPress,
}: ScheduleTimelineProps) {
  const theme = useTheme();
  const showTimes = phase !== 'idle';
  const timelineTracks = showTimes ? toTimelineTracks(rows) : buildIdleRows(playOrder, tracks);

  if (timelineTracks.length === 0) {
    return (
      <ThemedView type="backgroundElement" style={styles.empty}>
        <ThemedText themeColor="textSecondary">
          Добавьте треки на вкладке «Очередь».
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
        {showTimes ? 'Дальше по расписанию' : 'Порядок воспроизведения'}
      </ThemedText>
      <FlatList
        data={timelineTracks}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <TimelineItem
            row={item}
            isLast={index === timelineTracks.length - 1}
            showTimes={showTimes}
            onTrackPress={onTrackPress}
            accentColor="#3c87f7"
            mutedColor={theme.textSecondary}
          />
        )}
      />
    </ThemedView>
  );
}

function TimelineItem({
  row,
  isLast,
  showTimes,
  onTrackPress,
  accentColor,
  mutedColor,
}: {
  row: ScheduleRow;
  isLast: boolean;
  showTimes: boolean;
  onTrackPress?: (orderIndex: number) => void;
  accentColor: string;
  mutedColor: string;
}) {
  const isCurrent = row.isCurrent;
  const orderIndex = row.orderIndex;

  const content = (
    <View style={styles.itemRow}>
      <View style={styles.rail}>
        <View
          style={[
            styles.dot,
            isCurrent && { backgroundColor: accentColor, borderColor: accentColor },
            !isCurrent && { borderColor: mutedColor },
          ]}
        />
        {!isLast ? <View style={[styles.line, { backgroundColor: mutedColor }]} /> : null}
      </View>

      <ThemedView
        type={isCurrent ? 'backgroundSelected' : 'background'}
        style={[styles.card, isCurrent && styles.currentCard]}>
        <View style={styles.cardTop}>
          {showTimes ? (
            <ThemedText
              type="smallBold"
              themeColor={isCurrent ? 'text' : 'textSecondary'}
              style={styles.time}>
              {isCurrent ? 'сейчас' : formatClockTime(row.timestampMs)}
            </ThemedText>
          ) : null}
          <View style={[styles.badge, isCurrent && { backgroundColor: accentColor }]}>
            <ThemedText
              type="smallBold"
              style={[styles.badgeText, isCurrent && styles.badgeTextActive]}>
              {row.sequenceNumber}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="small" numberOfLines={2} style={isCurrent ? styles.currentName : undefined}>
          {row.label}
        </ThemedText>
      </ThemedView>
    </View>
  );

  if (orderIndex === null || !onTrackPress) {
    return content;
  }

  return (
    <Pressable onPress={() => onTrackPress(orderIndex)} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

function buildIdleRows(playOrder: number[], tracks: Track[]): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  for (const [orderIndex, trackIndex] of playOrder.slice(0, 10).entries()) {
    const track = tracks[trackIndex];
    if (!track) {
      continue;
    }
    rows.push({
      id: `idle-${track.id}`,
      kind: 'track',
      timestampMs: 0,
      orderIndex,
      sequenceNumber: orderIndex + 1,
      label: track.name,
      isCurrent: false,
      isEstimated: false,
    });
  }
  return rows;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  sectionTitle: {
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  empty: {
    flex: 1,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    justifyContent: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.three,
    minHeight: 72,
  },
  rail: {
    width: 20,
    alignItems: 'center',
    paddingTop: 18,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  line: {
    width: 2,
    flex: 1,
    opacity: 0.35,
    marginTop: 4,
  },
  card: {
    flex: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
    gap: Spacing.one,
  },
  currentCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#3c87f7',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  time: {
    fontVariant: ['tabular-nums'],
  },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(128,128,128,0.2)',
    marginLeft: 'auto',
  },
  badgeText: {
    fontSize: 13,
  },
  badgeTextActive: {
    color: '#ffffff',
  },
  currentName: {
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
});
