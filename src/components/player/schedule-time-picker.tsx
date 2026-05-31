import Slider from '@react-native-community/slider';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MINUTES_PER_DAY } from '@/types/profile';
import { formatTimeOfDay } from '@/utils/time';

type ScheduleTimePickerProps = {
  label: string;
  minutes: number;
  disabled?: boolean;
  onChange: (minutes: number) => void;
};

export function ScheduleTimePicker({ label, minutes, disabled, onChange }: ScheduleTimePickerProps) {
  const theme = useTheme();

  return (
    <View style={styles.block}>
      <ThemedText type="smallBold">
        {label}: {formatTimeOfDay(minutes)}
      </ThemedText>
      <Slider
        minimumValue={0}
        maximumValue={MINUTES_PER_DAY - 1}
        step={5}
        value={minutes}
        onValueChange={onChange}
        minimumTrackTintColor="#3c87f7"
        maximumTrackTintColor={theme.backgroundSelected}
        disabled={disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.one,
  },
});
