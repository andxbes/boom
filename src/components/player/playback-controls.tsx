import { type ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PlaybackControlsProps = {
  isQueueRunning: boolean;
  hasTracks: boolean;
  onToggle: () => void;
  onPrevious: () => void;
  onNext: () => void;
};

export function PlaybackControls({
  isQueueRunning,
  hasTracks,
  onToggle,
  onPrevious,
  onNext,
}: PlaybackControlsProps) {
  const theme = useTheme();
  const disabled = !hasTracks;

  return (
    <View style={styles.row}>
      <ControlButton
        icon="play-skip-back"
        onPress={onPrevious}
        disabled={disabled}
        color={theme.text}
      />
      <Pressable
        disabled={disabled}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.mainButton,
          { backgroundColor: theme.backgroundSelected },
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}>
        <Ionicons
          name={isQueueRunning ? 'pause' : 'play'}
          size={36}
          color={theme.text}
          style={isQueueRunning ? undefined : styles.playOffset}
        />
      </Pressable>
      <ControlButton
        icon="play-skip-forward"
        onPress={onNext}
        disabled={disabled}
        color={theme.text}
      />
    </View>
  );
}

function ControlButton({
  icon,
  onPress,
  disabled,
  color,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  disabled: boolean;
  color: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.sideButton,
        { backgroundColor: theme.backgroundElement },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <Ionicons name={icon} size={28} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  mainButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playOffset: {
    marginLeft: 4,
  },
  sideButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.75,
  },
});
