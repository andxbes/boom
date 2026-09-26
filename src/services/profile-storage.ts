import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createActivityInterval,
  createProfile,
  DEFAULT_AUTO_START_MINUTES,
  DEFAULT_AUTO_STOP_MINUTES,
  DEFAULT_SETTINGS,
  normalizeActivityIntervals,
  normalizeMinutesOfDay,
  type LegacyScheduleSettings,
  type Profile,
  type ProfileSettings,
  type ProfilesSnapshot,
} from '@/types/profile';

const STORAGE_KEY = '@boom/profiles';

export async function loadProfilesSnapshot(): Promise<ProfilesSnapshot> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const defaultProfile = createProfile('Основной');
    return {
      profiles: [defaultProfile],
      activeProfileId: defaultProfile.id,
    };
  }

  try {
    const parsed = JSON.parse(raw) as ProfilesSnapshot;
    if (!parsed.profiles?.length) {
      const defaultProfile = createProfile('Основной');
      return {
        profiles: [defaultProfile],
        activeProfileId: defaultProfile.id,
      };
    }
    return {
      profiles: parsed.profiles.map(normalizeProfile),
      activeProfileId: parsed.activeProfileId ?? parsed.profiles[0]?.id ?? null,
    };
  } catch {
    const defaultProfile = createProfile('Основной');
    return {
      profiles: [defaultProfile],
      activeProfileId: defaultProfile.id,
    };
  }
}

export async function saveProfilesSnapshot(snapshot: ProfilesSnapshot): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function migrateScheduleSettings(
  raw: Partial<ProfileSettings> & LegacyScheduleSettings,
): Pick<ProfileSettings, 'autoScheduleEnabled' | 'activityIntervals'> {
  if (Array.isArray(raw.activityIntervals) || typeof raw.autoScheduleEnabled === 'boolean') {
    return {
      autoScheduleEnabled: raw.autoScheduleEnabled ?? false,
      activityIntervals: Array.isArray(raw.activityIntervals)
        ? normalizeActivityIntervals(raw.activityIntervals)
        : [createActivityInterval()],
    };
  }

  const startMinutes = normalizeMinutesOfDay(
    raw.autoStartMinutes ?? DEFAULT_AUTO_START_MINUTES,
  );
  const endMinutes = normalizeMinutesOfDay(raw.autoStopMinutes ?? DEFAULT_AUTO_STOP_MINUTES);
  const enabled = Boolean(raw.autoStartEnabled || raw.autoStopEnabled);

  return {
    autoScheduleEnabled: enabled,
    activityIntervals: [createActivityInterval(startMinutes, endMinutes)],
  };
}

function normalizeProfile(profile: Profile): Profile {
  const rawSettings = (profile.settings ?? {}) as Partial<ProfileSettings> & LegacyScheduleSettings;
  const {
    autoStartEnabled: _autoStartEnabled,
    autoStopEnabled: _autoStopEnabled,
    autoStartMinutes: _autoStartMinutes,
    autoStopMinutes: _autoStopMinutes,
    ...rest
  } = rawSettings;

  const schedule = migrateScheduleSettings(rawSettings);

  return {
    ...profile,
    settings: {
      ...DEFAULT_SETTINGS,
      ...rest,
      ...schedule,
    },
    tracks: profile.tracks ?? [],
  };
}
