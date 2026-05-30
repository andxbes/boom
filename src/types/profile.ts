export type Track = {
  id: string;
  uri: string;
  name: string;
  /** Длительность в секундах, заполняется после первого воспроизведения. */
  durationSeconds?: number;
};

export type ProfileSettings = {
  shuffle: boolean;
  loop: boolean;
  intervalEnabled: boolean;
  /** Максимальная пауза между треками в секундах (0–3600). Фактическая — случайная от 0 до этого значения. */
  maxIntervalSeconds: number;
};

export type Profile = {
  id: string;
  name: string;
  tracks: Track[];
  settings: ProfileSettings;
  createdAt: number;
  updatedAt: number;
};

export type ProfilesSnapshot = {
  profiles: Profile[];
  activeProfileId: string | null;
};

export const MAX_INTERVAL_SECONDS = 3600;

export const DEFAULT_SETTINGS: ProfileSettings = {
  shuffle: false,
  loop: true,
  intervalEnabled: true,
  maxIntervalSeconds: 30,
};

export function createProfile(name: string, settings: ProfileSettings = DEFAULT_SETTINGS): Profile {
  const now = Date.now();
  return {
    id: createId(),
    name,
    tracks: [],
    settings: { ...settings },
    createdAt: now,
    updatedAt: now,
  };
}

export function createId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
