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
let expoVolume = 1;
let boostGainMilliBel = 0;
let lastLockScreenTitle = 'Boom';

function logQueue(message: string, extra?: unknown): void {
  if (!__DEV__) {
    return;
  }
  if (extra === undefined) {
    console.log(`[QUEUE] ${message}`);
    return;
  }
  console.log(`[QUEUE] ${message}`, extra);
}

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

export function statusToSnapshot(status: AudioStatus): TrackPlaybackSnapshot {
  if (!status.isLoaded) {
    return IDLE_PLAYBACK;
  }

  return {
    playing: status.playing,
    currentTime: status.currentTime,
    duration: status.duration > 0 ? status.duration : 0,
  };
}

export function isPlaybackAtEnd(status: AudioStatus): boolean {
  if (!status.isLoaded) {
    return false;
  }

  if (status.didJustFinish) {
    return true;
  }

  if (status.playing) {
    return false;
  }

  const duration = status.duration;
  if (duration <= FINISH_TOLERANCE_SEC) {
    return false;
  }

  if (status.currentTime < 0.2) {
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

export async function configureBackgroundPlayback(): Promise<void> {
  await reconfigureAudioSession();
}

export async function getActiveSoundStatus(): Promise<AudioStatus | null> {
  if (!activePlayer) {
    return null;
  }

  return activePlayer.currentStatus;
}

export async function pollActivePlaybackSnapshot(): Promise<TrackPlaybackSnapshot | null> {
  const status = await getActiveSoundStatus();
  if (!status) {
    return null;
  }
  return statusToSnapshot(status);
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

function releasePlayer(player: AudioPlayer): void {
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
  // Single-player mode has no separate prepared player.
}

export async function disposeActiveSound(): Promise<void> {
  detachStatusListener();
  const player = activePlayer;

  if (!player) {
    return;
  }

  try {
    player.pause();
  } catch {
    // Already paused/stopped.
  }
}

function createPlayer(uri: string | null, updateIntervalMs: number): AudioPlayer {
  return createAudioPlayer(uri, { updateInterval: updateIntervalMs });
}

function getOrCreateActivePlayer(updateIntervalMs: number): AudioPlayer {
  if (!activePlayer) {
    activePlayer = createPlayer(null, updateIntervalMs);
    activePlayer.loop = false;
  }
  return activePlayer;
}

/** Preloads the file without starting playback (no hidden audio in the background). */
export async function prepareTrackForPlayback(uri: string): Promise<void> {
  // In single-player mode we do not preload a second player instance.
  void uri;
}

export async function openAndPlayTrack(
  uri: string,
  onStatus: (status: TrackPlaybackSnapshot) => void,
  onFinished: () => void,
  options?: { fromQueue?: boolean; title?: string },
): Promise<void> {
  logQueue('openAndPlayTrack', { uri, fromQueue: options?.fromQueue ?? false });
  await reconfigureAudioSession();
  const player = getOrCreateActivePlayer(500);
  await disposeActiveSound();
  await applyPlaybackLevels(player);

  lastLockScreenTitle = options?.title ?? 'Boom';
  const lockScreenTitle = lastLockScreenTitle;
  player.loop = false;
  player.volume = expoVolume;
  logQueue('replace source');
  player.replace(uri);
  await waitUntilPlayerLoaded(player);
  logQueue('source loaded');
  await player.seekTo(0);
  await startActivePlayback(player, onStatus, onFinished, lockScreenTitle);
}

async function startActivePlayback(
  player: AudioPlayer,
  onStatus: (status: TrackPlaybackSnapshot) => void,
  onFinished: () => void,
  title: string,
): Promise<void> {
  let finished = false;
  const finishOnce = () => {
    if (finished || activePlayer !== player) {
      return;
    }
    finished = true;
    onFinished();
  };

  const onPlaybackStatusUpdate = (status: AudioStatus) => {
    if (activePlayer !== player) {
      return;
    }
    onStatus(statusToSnapshot(status));

    if (isPlaybackAtEnd(status)) {
      finishOnce();
    }
  };

  detachStatusListener();
  activeStatusSubscription = player.addListener('playbackStatusUpdate', onPlaybackStatusUpdate);
  activePlayer = player;

  await applyPlaybackLevels(player);
  activateLockScreen(player, title);
  await ensurePlaying(player);
  logQueue('playback started', { title });

  const initialStatus = player.currentStatus;
  onPlaybackStatusUpdate(initialStatus);
}

export async function pauseActiveSound(): Promise<void> {
  activePlayer?.pause();
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
  return activePlayer != null && activePlayer.isLoaded;
}

export async function releasePlaybackEngine(): Promise<void> {
  detachStatusListener();
  const player = activePlayer;
  activePlayer = null;

  if (!player) {
    return;
  }

  releasePlayer(player);
}

export const keepAwakeTag = KEEP_AWAKE_TAG;
