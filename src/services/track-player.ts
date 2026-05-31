import {
  Audio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
  type AVPlaybackStatus,
} from 'expo-av';
import { setVolumeBoostGainMilliBel } from 'boom-loudness';

export type TrackPlaybackSnapshot = {
  playing: boolean;
  currentTime: number;
  duration: number;
};

export const IDLE_PLAYBACK: TrackPlaybackSnapshot = {
  playing: false,
  currentTime: 0,
  duration: 0,
};

const FINISH_TOLERANCE_MS = 150;
const LOAD_POLL_MS = 40;
const LOAD_TIMEOUT_MS = 12_000;
const MAX_BOOST_MILLIBEL = 1000;

let activeSound: Audio.Sound | null = null;
let prepared: { uri: string; sound: Audio.Sound } | null = null;
let expoVolume = 1;
let boostGainMilliBel = 0;

function volumePercentToLevels(volumePercent: number): {
  expoVolume: number;
  boostGainMilliBel: number;
} {
  const normalized = Math.max(0, volumePercent);
  return {
    expoVolume: Math.min(1, normalized / 100),
    boostGainMilliBel:
      normalized <= 100
        ? 0
        : Math.round(((normalized - 100) / 100) * MAX_BOOST_MILLIBEL),
  };
}

export function setPlaybackVolume(volumePercent: number): void {
  const levels = volumePercentToLevels(volumePercent);
  expoVolume = levels.expoVolume;
  boostGainMilliBel = levels.boostGainMilliBel;
}

async function applyPlaybackLevels(sound?: Audio.Sound | null): Promise<void> {
  await setVolumeBoostGainMilliBel(boostGainMilliBel);

  if (!sound) {
    return;
  }

  try {
    await sound.setVolumeAsync(expoVolume);
  } catch {
    // Ignore volume errors on unsupported platforms.
  }
}

export async function applyVolumeToActiveSound(): Promise<void> {
  await applyPlaybackLevels(activeSound);
}

function toSnapshot(status: AVPlaybackStatus): TrackPlaybackSnapshot {
  if (!status.isLoaded) {
    return IDLE_PLAYBACK;
  }

  return {
    playing: status.isPlaying,
    currentTime: status.positionMillis / 1000,
    duration: status.durationMillis != null ? status.durationMillis / 1000 : 0,
  };
}

function isAtEnd(status: AVPlaybackStatus): boolean {
  if (!status.isLoaded || status.isPlaying) {
    return false;
  }

  if (status.didJustFinish) {
    return true;
  }

  const duration = status.durationMillis;
  if (duration == null || duration <= 0) {
    return false;
  }

  if (status.positionMillis < 50) {
    return false;
  }

  return status.positionMillis >= duration - FINISH_TOLERANCE_MS;
}

async function reconfigureAudioSession(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
  });
}

/** Call once at app start so background playback works before the first track opens. */
export async function configureBackgroundPlayback(): Promise<void> {
  await reconfigureAudioSession();
}

export async function getActiveSoundStatus(): Promise<AVPlaybackStatus | null> {
  if (!activeSound) {
    return null;
  }

  try {
    return await activeSound.getStatusAsync();
  } catch {
    return null;
  }
}

export function isPlaybackAtEnd(status: AVPlaybackStatus): boolean {
  return isAtEnd(status);
}

async function waitUntilLoaded(sound: Audio.Sound): Promise<AVPlaybackStatus> {
  const started = Date.now();

  while (Date.now() - started < LOAD_TIMEOUT_MS) {
    const status = await sound.getStatusAsync();
    if (status.isLoaded) {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, LOAD_POLL_MS));
  }

  throw new Error('Sound load timeout');
}

async function ensurePlaying(sound: Audio.Sound): Promise<void> {
  let status = await sound.getStatusAsync();
  if (!status.isLoaded) {
    status = await waitUntilLoaded(sound);
  }

  if (!status.isLoaded) {
    return;
  }

  if (status.isPlaying) {
    return;
  }

  await sound.playAsync();
  await new Promise((resolve) => setTimeout(resolve, 80));

  const afterPlay = await sound.getStatusAsync();
  if (afterPlay.isLoaded && !afterPlay.isPlaying) {
    await sound.setPositionAsync(0);
    await sound.playAsync();
  }
}

export async function disposePreparedSound(): Promise<void> {
  const entry = prepared;
  prepared = null;

  if (!entry) {
    return;
  }

  try {
    entry.sound.setOnPlaybackStatusUpdate(null);
    await entry.sound.stopAsync();
    await entry.sound.unloadAsync();
  } catch {
    // Already unloaded.
  }
}

export async function disposeActiveSound(): Promise<void> {
  const sound = activeSound;
  activeSound = null;

  if (!sound) {
    return;
  }

  try {
    sound.setOnPlaybackStatusUpdate(null);
    await sound.stopAsync();
  } catch {
    // Already stopped.
  }

  try {
    await sound.unloadAsync();
  } catch {
    // Already unloaded.
  }
}

export async function prepareTrackForPlayback(uri: string): Promise<void> {
  if (prepared?.uri === uri) {
    const status = await prepared.sound.getStatusAsync();
    if (status.isLoaded && status.isPlaying) {
      return;
    }
  }

  await disposePreparedSound();
  await reconfigureAudioSession();
  await applyPlaybackLevels();

  const { sound } = await Audio.Sound.createAsync(
    { uri },
    {
      shouldPlay: false,
      volume: 0,
      progressUpdateIntervalMillis: 250,
      isLooping: true,
    },
  );

  await waitUntilLoaded(sound);
  await sound.setPositionAsync(0);
  await ensurePlaying(sound);
  prepared = { uri, sound };
}

export async function openAndPlayTrack(
  uri: string,
  onStatus: (status: TrackPlaybackSnapshot) => void,
  onFinished: () => void,
  options?: { fromQueue?: boolean },
): Promise<void> {
  await reconfigureAudioSession();
  await disposeActiveSound();
  await applyPlaybackLevels();

  if (options?.fromQueue && prepared?.uri === uri) {
    const entry = prepared;
    prepared = null;
    await promotePreparedSound(entry.sound, onStatus, onFinished);
    return;
  }

  await disposePreparedSound();

  const { sound } = await Audio.Sound.createAsync(
    { uri },
    {
      shouldPlay: false,
      volume: expoVolume,
      progressUpdateIntervalMillis: 100,
      isLooping: false,
    },
  );

  await waitUntilLoaded(sound);
  await startActivePlayback(sound, onStatus, onFinished);
}

async function promotePreparedSound(
  sound: Audio.Sound,
  onStatus: (status: TrackPlaybackSnapshot) => void,
  onFinished: () => void,
): Promise<void> {
  try {
    await sound.pauseAsync();
    await sound.setIsLoopingAsync(false);
    await sound.setPositionAsync(0);
  } catch {
    // Continue and try playback anyway.
  }

  await startActivePlayback(sound, onStatus, onFinished);
}

async function startActivePlayback(
  sound: Audio.Sound,
  onStatus: (status: TrackPlaybackSnapshot) => void,
  onFinished: () => void,
): Promise<void> {
  let finished = false;
  const finishOnce = () => {
    if (finished) {
      return;
    }
    finished = true;
    onFinished();
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    onStatus(toSnapshot(status));

    if (!status.isLoaded) {
      return;
    }

    if (isAtEnd(status)) {
      finishOnce();
    }
  };

  sound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
  activeSound = sound;

  await applyPlaybackLevels(sound);
  await ensurePlaying(sound);

  const initialStatus = await sound.getStatusAsync();
  onPlaybackStatusUpdate(initialStatus);
  if (isAtEnd(initialStatus)) {
    finishOnce();
  }
}

export async function pauseActiveSound(): Promise<void> {
  if (!activeSound) {
    return;
  }

  await activeSound.pauseAsync();
}

export async function resumeActiveSound(): Promise<void> {
  if (!activeSound) {
    return;
  }

  await reconfigureAudioSession();
  await activeSound.playAsync();
}

export function hasActiveSound(): boolean {
  return activeSound != null;
}
