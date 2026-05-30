import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { ScheduleRow } from '@/services/schedule';
import { formatClockTime } from '@/utils/time';

type ScheduleTableProps = {
  rows: ScheduleRow[];
  emptyMessage?: string;
  onTrackPress?: (orderIndex: number) => void;
};

export function ScheduleTable({ rows, emptyMessage, onTrackPress }: ScheduleTableProps) {
  if (rows.length === 0) {
    return (
      <ThemedView type="backgroundElement" style={styles.empty}>
        <ThemedText themeColor="textSecondary">
          {emptyMessage ?? 'Добавьте треки на вкладке «Очередь», чтобы увидеть расписание.'}
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView type="backgroundElement" style={styles.table}>
      <View style={styles.headerRow}>
        <ThemedText type="smallBold" style={styles.timeCol}>
          Время
        </ThemedText>
        <ThemedText type="smallBold" style={styles.numCol}>
          №
        </ThemedText>
        <ThemedText type="smallBold" style={styles.labelCol}>
          Событие
        </ThemedText>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ScheduleRowView row={item} onTrackPress={onTrackPress} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </ThemedView>
  );
}

function ScheduleRowView({
  row,
  onTrackPress,
}: {
  row: ScheduleRow;
  onTrackPress?: (orderIndex: number) => void;
}) {
  const isPause = row.kind === 'pause';
  const isPressable = !isPause && row.orderIndex !== null && onTrackPress;

  const content = (
    <ThemedView
      type={row.isCurrent ? 'backgroundSelected' : 'background'}
      style={[styles.dataRow, row.isCurrent && styles.currentRow]}>
      <ThemedText
        type="small"
        style={styles.timeCol}
        themeColor={row.isEstimated ? 'textSecondary' : 'text'}>
        {row.isEstimated ? '~' : ''}
        {formatClockTime(row.timestampMs)}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.numCol} themeColor="textSecondary">
        {row.sequenceNumber ?? '—'}
      </ThemedText>
      <View style={styles.labelCol}>
        <ThemedText type="small" numberOfLines={2} themeColor={isPause ? 'textSecondary' : 'text'}>
          {row.isCurrent && !isPause ? '▶ ' : ''}
          {isPause ? row.label : `Трек ${row.sequenceNumber}: ${row.label}`}
        </ThemedText>
      </View>
    </ThemedView>
  );

  if (!isPressable) {
    return content;
  }

  return (
    <Pressable
      onPress={() => onTrackPress(row.orderIndex!)}
      style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  table: {
    flex: 1,
    borderRadius: Spacing.three,
    overflow: 'hidden',
    paddingBottom: Spacing.one,
  },
  empty: {
    flex: 1,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.25)',
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  currentRow: {
    borderLeftWidth: 3,
    borderLeftColor: '#3c87f7',
  },
  timeCol: {
    width: 88,
    fontVariant: ['tabular-nums'],
  },
  numCol: {
    width: 28,
    textAlign: 'center',
  },
  labelCol: {
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(128,128,128,0.15)',
    marginHorizontal: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
