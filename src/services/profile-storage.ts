import AsyncStorage from '@react-native-async-storage/async-storage';

import { createProfile, DEFAULT_SETTINGS, type Profile, type ProfilesSnapshot } from '@/types/profile';

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

function normalizeProfile(profile: Profile): Profile {
  return {
    ...profile,
    settings: {
      ...DEFAULT_SETTINGS,
      ...profile.settings,
    },
    tracks: profile.tracks ?? [],
  };
}
