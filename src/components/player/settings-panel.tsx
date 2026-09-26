import Slider from '@react-native-community/slider';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScheduleTimePicker } from '@/components/player/schedule-time-picker';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  createActivityInterval,
  MAX_INTERVAL_SECONDS,
  MAX_VOLUME_PERCENT,
  MIN_VOLUME_PERCENT,
  type ActivityInterval,
  type ProfileSettings,
} from '@/types/profile';
import { formatDuration } from '@/utils/time';

type SettingsPanelProps = {
  settings: ProfileSettings;
  onChange: (patch: Partial<ProfileSettings>) => void;
};

const PRESETS = [0, 30, 60, 300, 900, 1800, 3600];

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const theme = useTheme();
  const scheduleDisabled = !settings.autoScheduleEnabled;

  const updateInterval = (id: string, patch: Partial<Pick<ActivityInterval, 'startMinutes' | 'endMinutes'>>) => {
    onChange({
      activityIntervals: settings.activityIntervals.map((interval) =>
        interval.id === id ? { ...interval, ...patch } : interval,
      ),
    });
  };

  const addInterval = () => {
    onChange({
      activityIntervals: [...settings.activityIntervals, createActivityInterval()],
    });
  };

  const removeInterval = (id: string) => {
    onChange({
      activityIntervals: settings.activityIntervals.filter((interval) => interval.id !== id),
    });
  };

  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      <SettingRow
        label="Перемешивание"
        control={
          <Switch value={settings.shuffle} onValueChange={(shuffle) => onChange({ shuffle })} />
        }
      />
      <SettingRow
        label="Зацикливание очереди"
        control={<Switch value={settings.loop} onValueChange={(loop) => onChange({ loop })} />}
      />
      <SettingRow
        label="Случайная пауза между треками"
        control={
          <Switch
            value={settings.intervalEnabled}
            onValueChange={(intervalEnabled) => onChange({ intervalEnabled })}
          />
        }
      />
      <View style={styles.section}>
        <ThemedText type="smallBold">Расписание</ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          Несколько окон в течение суток. Если начало позже конца — интервал через полночь.
        </ThemedText>
        <SettingRow
          label="Включить расписание"
          control={
            <Switch
              value={settings.autoScheduleEnabled}
              onValueChange={(autoScheduleEnabled) => onChange({ autoScheduleEnabled })}
            />
          }
        />
        {settings.activityIntervals.map((interval, index) => (
          <View key={interval.id} style={styles.intervalCard}>
            <View style={styles.intervalHeader}>
              <ThemedText type="smallBold">Интервал {index + 1}</ThemedText>
              <Pressable
                accessibilityRole="button"
                disabled={scheduleDisabled}
                onPress={() => removeInterval(interval.id)}
                style={scheduleDisabled && styles.disabledControl}>
                <ThemedText type="linkPrimary">Удалить</ThemedText>
              </Pressable>
            </View>
            <View style={styles.intervalTimes}>
              <ScheduleTimePicker
                label="Начало"
                minutes={interval.startMinutes}
                disabled={scheduleDisabled}
                onChange={(startMinutes) => updateInterval(interval.id, { startMinutes })}
              />
              <ScheduleTimePicker
                label="Конец"
                minutes={interval.endMinutes}
                disabled={scheduleDisabled}
                onChange={(endMinutes) => updateInterval(interval.id, { endMinutes })}
              />
            </View>
          </View>
        ))}
        {settings.autoScheduleEnabled && settings.activityIntervals.length === 0 ? (
          <ThemedText themeColor="textSecondary" type="small">
            Добавьте хотя бы один интервал, чтобы расписание работало.
          </ThemedText>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={scheduleDisabled}
          onPress={addInterval}
          style={[
            styles.addButton,
            { backgroundColor: theme.backgroundSelected },
            scheduleDisabled && styles.disabledControl,
          ]}>
          <ThemedText type="smallBold">Добавить интервал</ThemedText>
        </Pressable>
      </View>
      <View style={styles.sliderBlock}>
        <ThemedText type="smallBold">Громкость: {settings.volumePercent}%</ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          100% — исходная громкость. Выше 100% — усиление на Android (нужна пересборка APK, не Expo Go).
        </ThemedText>
        <Slider
          minimumValue={MIN_VOLUME_PERCENT}
          maximumValue={MAX_VOLUME_PERCENT}
          step={5}
          value={settings.volumePercent}
          onValueChange={(volumePercent) => onChange({ volumePercent })}
          minimumTrackTintColor="#3c87f7"
          maximumTrackTintColor={theme.backgroundSelected}
        />
      </View>
      <View style={styles.sliderBlock}>
        <ThemedText type="smallBold">
          Макс. пауза: {formatDuration(settings.maxIntervalSeconds)}
        </ThemedText>
        <ThemedText themeColor="textSecondary" type="small">
          Фактическая пауза — случайное число от 0 до этого значения
        </ThemedText>
        <Slider
          minimumValue={0}
          maximumValue={MAX_INTERVAL_SECONDS}
          step={30}
          value={settings.maxIntervalSeconds}
          onValueChange={(maxIntervalSeconds) => onChange({ maxIntervalSeconds })}
          minimumTrackTintColor="#3c87f7"
          maximumTrackTintColor={theme.backgroundSelected}
          disabled={!settings.intervalEnabled}
        />
        <View style={styles.presets}>
          {PRESETS.map((value) => (
            <Pressable
              key={value}
              onPress={() => onChange({ maxIntervalSeconds: value, intervalEnabled: value > 0 })}
              style={[styles.preset, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="small">{formatDuration(value)}</ThemedText>
            </Pressable>
          ))}
        </View>
      </View>
    </ThemedView>
  );
}

function SettingRow({ label, control }: { label: string; control: ReactNode }) {
  return (
    <View style={styles.row}>
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      {control}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rowLabel: {
    flex: 1,
  },
  section: {
    gap: Spacing.two,
  },
  intervalCard: {
    gap: Spacing.two,
  },
  intervalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  intervalTimes: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  addButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  disabledControl: {
    opacity: 0.45,
  },
  sliderBlock: {
    gap: Spacing.one,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  preset: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
});
