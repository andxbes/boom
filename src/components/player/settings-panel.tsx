import Slider from '@react-native-community/slider';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  MAX_INTERVAL_SECONDS,
  MAX_VOLUME_PERCENT,
  MIN_VOLUME_PERCENT,
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
