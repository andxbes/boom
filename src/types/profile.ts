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
  /** Громкость в процентах от исходной: 100 = без усиления, 200 = в 2 раза громче. */
  volumePercent: number;
  /** Автозапуск очереди по времени (по умолчанию выкл.). */
  autoStartEnabled: boolean;
  /** Автоостановка очереди по времени (по умолчанию выкл.). */
  autoStopEnabled: boolean;
  /** Время автозапуска: минуты от полуночи (0–1439). */
  autoStartMinutes: number;
  /** Время автоостановки: минуты от полуночи (0–1439). */
  autoStopMinutes: number;
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
export const MAX_VOLUME_PERCENT = 200;
export const MIN_VOLUME_PERCENT = 100;
export const MINUTES_PER_DAY = 24 * 60;
export const DEFAULT_AUTO_START_MINUTES = 9 * 60;
export const DEFAULT_AUTO_STOP_MINUTES = 22 * 60;

export const DEFAULT_SETTINGS: ProfileSettings = {
  shuffle: false,
  loop: true,
  intervalEnabled: true,
  maxIntervalSeconds: 30,
  volumePercent: 100,
  autoStartEnabled: false,
  autoStopEnabled: false,
  autoStartMinutes: DEFAULT_AUTO_START_MINUTES,
  autoStopMinutes: DEFAULT_AUTO_STOP_MINUTES,
};

export function normalizeMinutesOfDay(minutes: number): number {
  const rounded = Math.round(minutes);
  if (rounded < 0) {
    return 0;
  }
  if (rounded >= MINUTES_PER_DAY) {
    return MINUTES_PER_DAY - 1;
  }
  return rounded;
}

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
