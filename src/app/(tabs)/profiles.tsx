import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/utils/time';

export default function ProfilesScreen() {
  const {
    isReady,
    profiles,
    activeProfileId,
    switchProfile,
    createNewProfile,
    renameProfile,
    deleteProfile,
    duplicateProfile,
  } = useApp();
  const theme = useTheme();
  const [newProfileName, setNewProfileName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  if (!isReady) {
    return (
      <ScreenShell>
        <ThemedView style={styles.centered}>
          <ActivityIndicator />
        </ThemedView>
      </ScreenShell>
    );
  }

  const handleCreate = async () => {
    const name = newProfileName.trim() || `Профиль ${profiles.length + 1}`;
    await createNewProfile(name);
    setNewProfileName('');
  };

  const handleRename = (profileId: string, currentName: string) => {
    setEditingProfileId(profileId);
    setEditingName(currentName);
  };

  const commitRename = async () => {
    if (!editingProfileId || !editingName.trim()) {
      setEditingProfileId(null);
      return;
    }
    await renameProfile(editingProfileId, editingName);
    setEditingProfileId(null);
    setEditingName('');
  };

  const handleDelete = (profileId: string, name: string) => {
    Alert.alert('Удалить профиль?', `Профиль «${name}» и все его треки будут удалены.`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => deleteProfile(profileId),
      },
    ]);
  };

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ThemedText type="subtitle">Профили</ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            Каждый профиль хранит свою очередь и настройки воспроизведения
          </ThemedText>

          {profiles.map((profile) => {
            const isActive = profile.id === activeProfileId;
            return (
              <ThemedView
                key={profile.id}
                type={isActive ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTexts}>
                  {editingProfileId === profile.id ? (
                    <TextInput
                      value={editingName}
                      onChangeText={setEditingName}
                      onSubmitEditing={commitRename}
                      onBlur={commitRename}
                      autoFocus
                      style={[styles.inlineInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
                    />
                  ) : (
                    <ThemedText type="smallBold">{profile.name}</ThemedText>
                  )}
                    <ThemedText themeColor="textSecondary" type="small">
                      {profile.tracks.length} треков · пауза до{' '}
                      {formatDuration(profile.settings.maxIntervalSeconds)}
                      {profile.settings.shuffle ? ' · shuffle' : ''}
                    </ThemedText>
                  </View>
                  {isActive ? (
                    <ThemedText type="smallBold" style={styles.activeBadge}>
                      Активен
                    </ThemedText>
                  ) : null}
                </View>
                <View style={styles.cardActions}>
                  {!isActive ? (
                    <ActionChip label="Выбрать" onPress={() => switchProfile(profile.id)} />
                  ) : null}
                  <ActionChip label="Переименовать" onPress={() => handleRename(profile.id, profile.name)} />
                  <ActionChip label="Дублировать" onPress={() => duplicateProfile(profile.id)} />
                  <ActionChip
                    label="Удалить"
                    destructive
                    onPress={() => handleDelete(profile.id, profile.name)}
                  />
                </View>
              </ThemedView>
            );
          })}

          <ThemedView type="backgroundElement" style={styles.createBlock}>
            <ThemedText type="smallBold">Новый профиль</ThemedText>
            <TextInput
              value={newProfileName}
              onChangeText={setNewProfileName}
              placeholder="Название профиля"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            />
            <Pressable
              onPress={handleCreate}
              style={({ pressed }) => [
                styles.createButton,
                { backgroundColor: theme.backgroundSelected },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="smallBold">Создать профиль</ThemedText>
            </Pressable>
          </ThemedView>
        </ScrollView>
    </ScreenShell>
  );
}

function ActionChip({
  label,
  onPress,
  destructive,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: theme.background }]}
      hitSlop={4}>
      <ThemedText type="small" style={destructive ? { color: '#e5484d' } : undefined}>
        {label}
      </ThemedText>
    </Pressable>
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
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  cardTexts: {
    flex: 1,
    gap: Spacing.one,
  },
  activeBadge: {
    color: '#3c87f7',
  },
  cardActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
  createBlock: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  createButton: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  inlineInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.75,
  },
});
