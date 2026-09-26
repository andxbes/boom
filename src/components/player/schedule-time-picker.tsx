import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import { createElement, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatTimeOfDay } from '@/utils/time';

type ScheduleTimePickerProps = {
  label: string;
  minutes: number;
  disabled?: boolean;
  onChange: (minutes: number) => void;
};

function minutesToDate(minutes: number): Date {
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

function dateToMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function parseTimeInput(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 23 || mins > 59) {
    return null;
  }
  return hours * 60 + mins;
}

export function ScheduleTimePicker({ label, minutes, disabled, onChange }: ScheduleTimePickerProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  const handleValueChange = (_event: DateTimePickerChangeEvent, selected: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
    }
    onChange(dateToMinutes(selected));
  };

  const handleDismiss = () => {
    setOpen(false);
  };

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.block, disabled && styles.disabled]}>
        <ThemedText type="smallBold">{label}</ThemedText>
        {createElement('input', {
          type: 'time',
          value: formatTimeOfDay(minutes),
          disabled,
          onChange: (event: { target: { value: string } }) => {
            const parsed = parseTimeInput(event.target.value);
            if (parsed !== null) {
              onChange(parsed);
            }
          },
          style: {
            fontSize: 14,
            fontWeight: 700,
            padding: 8,
            borderRadius: 8,
            border: 'none',
            backgroundColor: theme.backgroundSelected,
            color: theme.text,
          },
        })}
      </View>
    );
  }

  return (
    <View style={[styles.block, disabled && styles.disabled]}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.valueButton, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold">{formatTimeOfDay(minutes)}</ThemedText>
      </Pressable>

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={minutesToDate(minutes)}
          mode="time"
          is24Hour
          display="default"
          onValueChange={handleValueChange}
          onDismiss={handleDismiss}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Pressable
              style={[styles.sheet, { backgroundColor: theme.background }]}
              onPress={(event) => event.stopPropagation()}>
              <View style={styles.sheetHeader}>
                <ThemedText type="smallBold">{label}</ThemedText>
                <Pressable onPress={() => setOpen(false)} accessibilityRole="button">
                  <ThemedText type="linkPrimary">Готово</ThemedText>
                </Pressable>
              </View>
              <DateTimePicker
                value={minutesToDate(minutes)}
                mode="time"
                display="spinner"
                onValueChange={handleValueChange}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.one,
    flex: 1,
  },
  disabled: {
    opacity: 0.45,
  },
  valueButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: Spacing.three,
    borderTopRightRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
