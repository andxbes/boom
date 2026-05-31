import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';
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

const FINISH_TOLERANCE_SEC = 0.15;
const LOAD_POLL_MS = 40;
const LOAD_TIMEOUT_MS = 12_000;
const MAX_BOOST_MILLIBEL = 1000;
const KEEP_AWAKE_TAG = 'boom-queue';

let activePlayer: AudioPlayer | null = null;
let activeStatusSubscription: { remove: () => void } | null = null;
let prepared: { uri: string; player: AudioPlayer } | null = null;
let expoVolume = 1;
let boostGainMilliBel = 0;
let lastLockScreenTitle = 'Boom';

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

async function applyPlaybackLevels(player?: AudioPlayer | null): Promise<void> {
  await setVolumeBoostGainMilliBel(boostGainMilliBel);

  if (!player) {
    return;
  }

  player.volume = expoVolume;
}

export async function applyVolumeToActiveSound(): Promise<void> {
  await applyPlaybackLevels(activePlayer);
}

function toSnapshot(status: AudioStatus): TrackPlaybackSnapshot {
  if (!status.isLoaded) {
    return IDLE_PLAYBACK;
  }

  return {
    playing: status.playing,
    currentTime: status.currentTime,
    duration: status.duration > 0 ? status.duration : 0,
  };
}

function isAtEnd(status: AudioStatus): boolean {
  if (!status.isLoaded || status.playing) {
    return false;
  }

  if (status.didJustFinish) {
    return true;
  }

  const duration = status.duration;
  if (duration <= 0) {
    return false;
  }

  if (status.currentTime < 0.05) {
    return false;
  }

  return status.currentTime >= duration - FINISH_TOLERANCE_SEC;
}

async function reconfigureAudioSession(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
    allowsRecording: false,
  });
}

/** Call once at app start so background playback works before the first track opens. */
export async function configureBackgroundPlayback(): Promise<void> {
  await reconfigureAudioSession();
}

export async function getActiveSoundStatus(): Promise<AudioStatus | null> {
  if (!activePlayer) {
    return null;
  }

  return activePlayer.currentStatus;
}

export function isPlaybackAtEnd(status: AudioStatus): boolean {
  return isAtEnd(status);
}

async function waitUntilPlayerLoaded(player: AudioPlayer): Promise<void> {
  const started = Date.now();

  while (Date.now() - started < LOAD_TIMEOUT_MS) {
    if (player.isLoaded) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, LOAD_POLL_MS));
  }

  throw new Error('Sound load timeout');
}

async function ensurePlaying(player: AudioPlayer): Promise<void> {
  await waitUntilPlayerLoaded(player);

  if (player.playing) {
    return;
  }

  player.play();
  await new Promise((resolve) => setTimeout(resolve, 80));

  if (!player.playing) {
    await player.seekTo(0);
    player.play();
  }
}

function detachStatusListener(): void {
  activeStatusSubscription?.remove();
  activeStatusSubscription = null;
}

function activateLockScreen(player: AudioPlayer, title: string): void {
  player.setActiveForLockScreen(true, {
    title: title || 'Boom',
    artist: 'Boom',
  });
}

function deactivateLockScreen(player: AudioPlayer): void {
  player.clearLockScreenControls();
}

function disposePlayer(player: AudioPlayer): void {
  try {
    player.pause();
  } catch {
    // Already stopped.
  }

  try {
    deactivateLockScreen(player);
  } catch {
    // Ignore.
  }

  try {
    player.remove();
  } catch {
    // Already removed.
  }
}

export async function disposePreparedSound(): Promise<void> {
  const entry = prepared;
  prepared = null;

  if (!entry) {
    return;
  }

  disposePlayer(entry.player);
}

export async function disposeActiveSound(): Promise<void> {
  detachStatusListener();
  const player = activePlayer;
  activePlayer = null;

  if (!player) {
    return;
  }

  disposePlayer(player);
}

function createPlayer(uri: string, updateIntervalMs: number): AudioPlayer {
  return createAudioPlayer(uri, { updateInterval: updateIntervalMs });
}

export async function prepareTrackForPlayback(uri: string): Promise<void> {
  if (prepared?.uri === uri) {
    if (prepared.player.isLoaded && prepared.player.playing) {
      return;
    }
  }

  await disposePreparedSound();
  await reconfigureAudioSession();
  await applyPlaybackLevels();

  const player = createPlayer(uri, 250);
  player.loop = true;
  player.volume = 0;
  await waitUntilPlayerLoaded(player);
  await player.seekTo(0);
  await ensurePlaying(player);
  prepared = { uri, player };
}

export async function openAndPlayTrack(
  uri: string,
  onStatus: (status: TrackPlaybackSnapshot) => void,
  onFinished: () => void,
  options?: { fromQueue?: boolean; title?: string },
): Promise<void> {
  await reconfigureAudioSession();
  await disposeActiveSound();
  await applyPlaybackLevels();

  lastLockScreenTitle = options?.title ?? 'Boom';
  const lockScreenTitle = lastLockScreenTitle;

  if (options?.fromQueue && prepared?.uri === uri) {
    const entry = prepared;
    prepared = null;
    await promotePreparedPlayer(entry.player, onStatus, onFinished, lockScreenTitle);
    return;
  }

  await disposePreparedSound();

  const player = createPlayer(uri, 100);
  player.loop = false;
  player.volume = expoVolume;
  await waitUntilPlayerLoaded(player);
  await startActivePlayback(player, onStatus, onFinished, lockScreenTitle);
}

async function promotePreparedPlayer(
  player: AudioPlayer,
  onStatus: (status: TrackPlaybackSnapshot) => void,
  onFinished: () => void,
  title: string,
): Promise<void> {
  try {
    player.pause();
    player.loop = false;
    await player.seekTo(0);
  } catch {
    // Continue and try playback anyway.
  }

  player.volume = expoVolume;
  await startActivePlayback(player, onStatus, onFinished, title);
}

async function startActivePlayback(
  player: AudioPlayer,
  onStatus: (status: TrackPlaybackSnapshot) => void,
  onFinished: () => void,
  title: string,
): Promise<void> {
  let finished = false;
  const finishOnce = () => {
    if (finished) {
      return;
    }
    finished = true;
    onFinished();
  };

  const onPlaybackStatusUpdate = (status: AudioStatus) => {
    onStatus(toSnapshot(status));

    if (!status.isLoaded) {
      return;
    }

    if (isAtEnd(status)) {
      finishOnce();
    }
  };

  detachStatusListener();
  activeStatusSubscription = player.addListener('playbackStatusUpdate', onPlaybackStatusUpdate);
  activePlayer = player;

  await applyPlaybackLevels(player);
  activateLockScreen(player, title);
  await ensurePlaying(player);

  const initialStatus = player.currentStatus;
  onPlaybackStatusUpdate(initialStatus);
  if (isAtEnd(initialStatus)) {
    finishOnce();
  }
}

export async function pauseActiveSound(): Promise<void> {
  if (!activePlayer) {
    return;
  }

  activePlayer.pause();
}

export async function resumeActiveSound(): Promise<void> {
  if (!activePlayer) {
    return;
  }

  await reconfigureAudioSession();
  activateLockScreen(activePlayer, lastLockScreenTitle);
  activePlayer.play();
}

export function hasActiveSound(): boolean {
  return activePlayer != null;
}

export const keepAwakeTag = KEEP_AWAKE_TAG;
