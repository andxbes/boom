import * as DocumentPicker from 'expo-document-picker';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert, AppState } from 'react-native';

import {
  buildPlayOrder,
  getNextQueueIndex,
  getRandomIntervalSeconds,
  getTrackAt,
  type PlayerPhase,
} from '@/services/queue';
import { isSchedulePlaybackAllowed } from '@/services/auto-schedule';
import { buildSchedule, type ScheduleRow } from '@/services/schedule';
import { loadProfilesSnapshot, saveProfilesSnapshot } from '@/services/profile-storage';
import {
  applyVolumeToActiveSound,
  disposeActiveSound,
  disposePreparedSound,
  hasActiveSound,
  IDLE_PLAYBACK,
  openAndPlayTrack,
  pauseActiveSound,
  prepareTrackForPlayback,
  resumeActiveSound,
  setPlaybackVolume,
  type TrackPlaybackSnapshot,
} from '@/services/track-player';
import { persistTrack, removeTrackFile } from '@/services/track-files';
import {
  createProfile,
  MAX_INTERVAL_SECONDS,
  MAX_VOLUME_PERCENT,
  MIN_VOLUME_PERCENT,
  normalizeMinutesOfDay,
  type Profile,
  type ProfileSettings,
  type ProfilesSnapshot,
  type Track,
} from '@/types/profile';

type AppContextValue = {
  isReady: boolean;
  profiles: Profile[];
  activeProfile: Profile | null;
  activeProfileId: string | null;
  phase: PlayerPhase;
  currentTrack: Track | null;
  currentOrderIndex: number;
  playOrder: number[];
  waitingSecondsLeft: number;
  waitingTotalSeconds: number;
  pendingNextOrderIndex: number | null;
  isPlaying: boolean;
  isQueueRunning: boolean;
  isAutoScheduleEnabled: boolean;
  autoSchedulePlaybackAllowed: boolean | null;
  scheduleManualHold: boolean;
  schedule: ScheduleRow[];
  playbackCurrentTime: number;
  playbackDuration: number;
  pickAndAddTracks: () => Promise<void>;
  removeTrack: (trackId: string) => Promise<void>;
  moveTrack: (fromIndex: number, toIndex: number) => Promise<void>;
  updateSettings: (patch: Partial<ProfileSettings>) => Promise<void>;
  createNewProfile: (name: string) => Promise<void>;
  renameProfile: (profileId: string, name: string) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  switchProfile: (profileId: string) => Promise<void>;
  duplicateProfile: (profileId: string) => Promise<void>;
  play: () => void;
  pause: () => void;
  togglePlayback: () => void;
  skipToNext: () => void;
  skipToPrevious: () => void;
  playTrackAt: (trackIndex: number) => void;
  playTrackAtOrderIndex: (orderIndex: number) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

const AUDIO_MIME_TYPES = ['audio/*'];

export function AppProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ProfilesSnapshot | null>(null);
  const [phase, setPhase] = useState<PlayerPhase>('idle');
  const [currentOrderIndex, setCurrentOrderIndex] = useState(0);
  const [playOrder, setPlayOrder] = useState<number[]>([]);
  const [waitingSecondsLeft, setWaitingSecondsLeft] = useState(0);
  const [waitingTotalSeconds, setWaitingTotalSeconds] = useState(0);
  const [pendingNextOrderIndex, setPendingNextOrderIndex] = useState<number | null>(null);
  const [playbackSnapshot, setPlaybackSnapshot] = useState<TrackPlaybackSnapshot>(IDLE_PLAYBACK);
  const [autoSchedulePlaybackAllowed, setAutoSchedulePlaybackAllowed] = useState<boolean | null>(null);
  const [scheduleManualHold, setScheduleManualHold] = useState(false);

  const phaseRef = useRef(phase);
  const playOrderRef = useRef(playOrder);
  const currentOrderIndexRef = useRef(currentOrderIndex);
  const waitingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitingEndsAtRef = useRef<number | null>(null);
  const lastFinishedTrackIdRef = useRef<string | null>(null);
  const openGenerationRef = useRef(0);
  const previousProfileIdRef = useRef<string | null>(null);
  const scheduleManualHoldRef = useRef(false);
  const pendingNextOrderIndexRef = useRef(pendingNextOrderIndex);
  const playRef = useRef<() => void>(() => {});
  const stopQueueRef = useRef<() => Promise<void>>(async () => {});

  phaseRef.current = phase;
  pendingNextOrderIndexRef.current = pendingNextOrderIndex;
  playOrderRef.current = playOrder;
  currentOrderIndexRef.current = currentOrderIndex;

  const activeProfile = useMemo(
    () => snapshot?.profiles.find((profile) => profile.id === snapshot.activeProfileId) ?? null,
    [snapshot],
  );

  const currentTrack = useMemo(
    () => (activeProfile ? getTrackAt(playOrder, currentOrderIndex, activeProfile.tracks) : null),
    [activeProfile, playOrder, currentOrderIndex],
  );

  const isAutoScheduleEnabled = activeProfile
    ? activeProfile.settings.autoStartEnabled || activeProfile.settings.autoStopEnabled
    : false;

  const schedule = useMemo(
    () =>
      activeProfile
        ? buildSchedule({
            tracks: activeProfile.tracks,
            playOrder,
            settings: activeProfile.settings,
            phase,
            currentOrderIndex,
            pendingNextOrderIndex,
            currentTime: playbackSnapshot.currentTime,
            currentDuration: playbackSnapshot.duration,
            waitingSecondsLeft,
            waitingTotalSeconds,
          })
        : [],
    [
      activeProfile,
      playOrder,
      phase,
      currentOrderIndex,
      pendingNextOrderIndex,
      playbackSnapshot.currentTime,
      playbackSnapshot.duration,
      waitingSecondsLeft,
      waitingTotalSeconds,
    ],
  );

  const clearWaitingTimer = () => {
    if (waitingTimerRef.current) {
      clearInterval(waitingTimerRef.current);
      waitingTimerRef.current = null;
    }
  };

  const stopPlayback = useCallback(async () => {
    await disposeActiveSound();
    setPlaybackSnapshot(IDLE_PLAYBACK);
  }, []);

  useEffect(() => {
    void loadProfilesSnapshot().then((loaded) => {
      setSnapshot(loaded);
      setPlayOrder(buildPlayOrder(loaded.profiles[0]?.tracks.length ?? 0, loaded.profiles[0]?.settings.shuffle ?? false));
    });
  }, []);

  useEffect(() => {
    return () => {
      clearWaitingTimer();
      void disposeActiveSound();
      void disposePreparedSound();
    };
  }, []);

  useEffect(() => {
    scheduleManualHoldRef.current = false;
    setScheduleManualHold(false);
    setAutoSchedulePlaybackAllowed(null);
    previousProfileIdRef.current = null;
  }, [activeProfile?.id]);

  useEffect(() => {
    if (!activeProfile) {
      return;
    }

    const previousProfileId = previousProfileIdRef.current;
    previousProfileIdRef.current = activeProfile.id;

    if (previousProfileId !== null && previousProfileId !== activeProfile.id) {
      setPlayOrder(buildPlayOrder(activeProfile.tracks.length, activeProfile.settings.shuffle));
      setCurrentOrderIndex(0);
      setPhase('idle');
      clearWaitingTimer();
      void stopPlayback();
    }
  }, [activeProfile?.id, stopPlayback]);

  useEffect(() => {
    if (!activeProfile) {
      return;
    }
    setPlayOrder(buildPlayOrder(activeProfile.tracks.length, activeProfile.settings.shuffle));
    if (currentOrderIndex >= activeProfile.tracks.length) {
      setCurrentOrderIndex(0);
    }
  }, [activeProfile?.tracks.length, activeProfile?.settings.shuffle]);

  const persistSnapshot = useCallback(async (next: ProfilesSnapshot) => {
    setSnapshot(next);
    await saveProfilesSnapshot(next);
  }, []);

  const updateActiveProfile = useCallback(
    async (updater: (profile: Profile) => Profile) => {
      if (!snapshot?.activeProfileId) {
        return;
      }
      const profiles = snapshot.profiles.map((profile) =>
        profile.id === snapshot.activeProfileId
          ? { ...updater(profile), updatedAt: Date.now() }
          : profile,
      );
      await persistSnapshot({ ...snapshot, profiles });
    },
    [persistSnapshot, snapshot],
  );

  useEffect(() => {
    if (!activeProfile || !currentTrack || !playbackSnapshot.duration || playbackSnapshot.duration <= 0) {
      return;
    }
    if (phaseRef.current !== 'playing') {
      return;
    }
    const rounded = Math.round(playbackSnapshot.duration);
    if (currentTrack.durationSeconds === rounded) {
      return;
    }
    void updateActiveProfile((profile) => ({
      ...profile,
      tracks: profile.tracks.map((track) =>
        track.id === currentTrack.id ? { ...track, durationSeconds: rounded } : track,
      ),
    }));
  }, [activeProfile, currentTrack, playbackSnapshot.duration, updateActiveProfile]);

  const syncWaitingSecondsLeft = () => {
    if (waitingEndsAtRef.current === null) {
      return 0;
    }
    return Math.max(0, Math.ceil((waitingEndsAtRef.current - Date.now()) / 1000));
  };

  const openTrackRef = useRef<
    (orderIndex: number, nextPlayOrder?: number[], fromQueue?: boolean) => Promise<void>
  >(async () => {});
  const startWaitingForNextRef = useRef<(nextOrderIndex: number) => void>(() => {});

  const syncPlaybackVolume = useCallback((volumePercent: number) => {
    setPlaybackVolume(volumePercent);
  }, []);

  const advanceQueueAfterTrack = useCallback(
    async (finishedTrackId: string) => {
      if (lastFinishedTrackIdRef.current === finishedTrackId) {
        return;
      }
      lastFinishedTrackIdRef.current = finishedTrackId;

      if (!activeProfile) {
        await stopPlayback();
        setPhase('idle');
        return;
      }

      const nextOrderIndex = getNextQueueIndex(
        playOrderRef.current,
        currentOrderIndexRef.current,
        activeProfile.settings.loop,
      );

      if (nextOrderIndex === null) {
        await stopPlayback();
        setPhase('idle');
        waitingEndsAtRef.current = null;
        setPendingNextOrderIndex(null);
        return;
      }

      const nextTrack = getTrackAt(playOrderRef.current, nextOrderIndex, activeProfile.tracks);
      syncPlaybackVolume(activeProfile.settings.volumePercent);
      const preparePromise = nextTrack
        ? prepareTrackForPlayback(nextTrack.uri).catch((error) => {
            console.warn('Failed to prepare next track:', error);
          })
        : Promise.resolve();

      await stopPlayback();
      await preparePromise;

      startWaitingForNextRef.current(nextOrderIndex);
    },
    [activeProfile, stopPlayback, syncPlaybackVolume],
  );

  const openTrack = useCallback(
    async (orderIndex: number, nextPlayOrder = playOrderRef.current, fromQueue = false) => {
      if (!activeProfile) {
        return;
      }

      syncPlaybackVolume(activeProfile.settings.volumePercent);

      const track = getTrackAt(nextPlayOrder, orderIndex, activeProfile.tracks);
      if (!track) {
        await stopPlayback();
        setPhase('idle');
        return;
      }

      openGenerationRef.current += 1;
      const generation = openGenerationRef.current;

      lastFinishedTrackIdRef.current = null;
      currentOrderIndexRef.current = orderIndex;
      setCurrentOrderIndex(orderIndex);
      setPhase('playing');
      clearWaitingTimer();
      waitingEndsAtRef.current = null;
      setWaitingSecondsLeft(0);
      setWaitingTotalSeconds(0);
      setPendingNextOrderIndex(null);
      setPlaybackSnapshot(IDLE_PLAYBACK);

      try {
        await openAndPlayTrack(
          track.uri,
          (snapshot) => {
            if (openGenerationRef.current !== generation) {
              return;
            }
            setPlaybackSnapshot(snapshot);
          },
          () => {
            if (openGenerationRef.current !== generation) {
              return;
            }
            if (phaseRef.current !== 'playing') {
              return;
            }
            if (currentOrderIndexRef.current !== orderIndex) {
              return;
            }
            void advanceQueueAfterTrack(track.id);
          },
          { fromQueue },
        );
      } catch (error) {
        console.warn('Failed to play track:', error);
        if (openGenerationRef.current === generation) {
          setPhase('idle');
          setPlaybackSnapshot(IDLE_PLAYBACK);
        }
      }
    },
    [activeProfile, advanceQueueAfterTrack, stopPlayback, syncPlaybackVolume],
  );

  const startWaitingForNext = useCallback(
    (nextOrderIndex: number) => {
      if (!activeProfile) {
        return;
      }

      const nextTrack = getTrackAt(playOrderRef.current, nextOrderIndex, activeProfile.tracks);
      syncPlaybackVolume(activeProfile.settings.volumePercent);
      if (nextTrack) {
        void prepareTrackForPlayback(nextTrack.uri).catch((error) => {
          console.warn('Failed to prepare track:', error);
        });
      }

      const delaySeconds = getRandomIntervalSeconds(activeProfile.settings);
      if (delaySeconds <= 0) {
        void openTrackRef.current(nextOrderIndex, playOrderRef.current, true);
        return;
      }

      const endsAtMs = Date.now() + delaySeconds * 1000;
      waitingEndsAtRef.current = endsAtMs;
      setPhase('waiting');
      setPendingNextOrderIndex(nextOrderIndex);
      setWaitingSecondsLeft(delaySeconds);
      setWaitingTotalSeconds(delaySeconds);
      clearWaitingTimer();

      const tick = () => {
        const remaining = syncWaitingSecondsLeft();
        setWaitingSecondsLeft(remaining);
        if (remaining <= 0) {
          clearWaitingTimer();
          waitingEndsAtRef.current = null;
          void openTrackRef.current(nextOrderIndex, playOrderRef.current, true);
        }
      };

      tick();
      waitingTimerRef.current = setInterval(tick, 250);
    },
    [activeProfile, syncPlaybackVolume],
  );

  openTrackRef.current = openTrack;
  startWaitingForNextRef.current = startWaitingForNext;

  const playTrackAtOrderIndex = useCallback(
    (orderIndex: number) => {
      if (!activeProfile) {
        return;
      }
      clearWaitingTimer();
      void disposePreparedSound();
      void openTrack(orderIndex, playOrderRef.current, false);
    },
    [activeProfile, openTrack],
  );

  const startWaitingBeforeTrack = useCallback(
    (orderIndex: number) => {
      startWaitingForNext(orderIndex);
    },
    [startWaitingForNext],
  );

  const resumeWaitingTimer = useCallback(
    (orderIndex: number, secondsLeft: number, totalSeconds?: number) => {
      if (activeProfile) {
        syncPlaybackVolume(activeProfile.settings.volumePercent);
        const nextTrack = getTrackAt(playOrderRef.current, orderIndex, activeProfile.tracks);
        if (nextTrack) {
          void prepareTrackForPlayback(nextTrack.uri).catch((error) => {
            console.warn('Failed to prepare track:', error);
          });
        }
      }

      const endsAtMs = Date.now() + secondsLeft * 1000;
      waitingEndsAtRef.current = endsAtMs;
      setPhase('waiting');
      setPendingNextOrderIndex(orderIndex);
      setWaitingSecondsLeft(secondsLeft);
      setWaitingTotalSeconds(totalSeconds ?? secondsLeft);
      clearWaitingTimer();

      const tick = () => {
        const remaining = syncWaitingSecondsLeft();
        setWaitingSecondsLeft(remaining);
        if (remaining <= 0) {
          clearWaitingTimer();
          waitingEndsAtRef.current = null;
          void openTrack(orderIndex, playOrderRef.current, true);
        }
      };

      tick();
      waitingTimerRef.current = setInterval(tick, 250);
    },
    [activeProfile, openTrack, syncPlaybackVolume],
  );

  useEffect(() => {
    if (phase !== 'playing' || !activeProfile) {
      return;
    }

    if (playbackSnapshot.duration <= 0) {
      return;
    }

    const remaining = playbackSnapshot.duration - playbackSnapshot.currentTime;
    if (remaining > 0.5) {
      return;
    }

    const watchdog = setTimeout(() => {
      if (phaseRef.current !== 'playing') {
        return;
      }

      const current = getTrackAt(
        playOrderRef.current,
        currentOrderIndexRef.current,
        activeProfile.tracks,
      );
      if (!current) {
        return;
      }

      void advanceQueueAfterTrack(current.id);
    }, 900);

    return () => clearTimeout(watchdog);
  }, [
    activeProfile,
    advanceQueueAfterTrack,
    phase,
    playbackSnapshot.currentTime,
    playbackSnapshot.duration,
  ]);

  const play = useCallback(() => {
    if (!activeProfile || activeProfile.tracks.length === 0) {
      return;
    }

    scheduleManualHoldRef.current = false;
    setScheduleManualHold(false);

    if (phaseRef.current === 'paused') {
      if (pendingNextOrderIndex !== null && waitingSecondsLeft > 0) {
        resumeWaitingTimer(pendingNextOrderIndex, waitingSecondsLeft, waitingTotalSeconds);
        return;
      }
      if (hasActiveSound()) {
        void resumeActiveSound();
        setPhase('playing');
        return;
      }
      void openTrack(currentOrderIndexRef.current);
      return;
    }

    if (phaseRef.current === 'idle') {
      startWaitingBeforeTrack(currentOrderIndexRef.current);
      return;
    }

    if (phaseRef.current === 'playing' && !playbackSnapshot.playing && hasActiveSound()) {
      void resumeActiveSound();
      setPhase('playing');
    }
  }, [
    activeProfile,
    openTrack,
    pendingNextOrderIndex,
    playbackSnapshot.playing,
    resumeWaitingTimer,
    startWaitingBeforeTrack,
    waitingSecondsLeft,
    waitingTotalSeconds,
  ]);

  const pause = useCallback(() => {
    scheduleManualHoldRef.current = true;
    setScheduleManualHold(true);

    if (phaseRef.current === 'waiting') {
      clearWaitingTimer();
      const remaining = syncWaitingSecondsLeft();
      setWaitingSecondsLeft(remaining);
      waitingEndsAtRef.current = null;
      setPhase('paused');
      return;
    }
    if (phaseRef.current === 'playing') {
      void pauseActiveSound();
      setPhase('paused');
    }
  }, []);

  const stopQueue = useCallback(async () => {
    clearWaitingTimer();
    waitingEndsAtRef.current = null;
    setPendingNextOrderIndex(null);
    setWaitingSecondsLeft(0);
    setWaitingTotalSeconds(0);
    await stopPlayback();
    void disposePreparedSound();
    setPhase('idle');
    scheduleManualHoldRef.current = false;
    setScheduleManualHold(false);
  }, [stopPlayback]);

  playRef.current = play;
  stopQueueRef.current = stopQueue;

  useEffect(() => {
    if (!activeProfile) {
      return;
    }

    const tick = () => {
      const allowed = isSchedulePlaybackAllowed(activeProfile.settings);
      setAutoSchedulePlaybackAllowed(allowed);

      if (allowed === null) {
        return;
      }

      const queueActive =
        phaseRef.current === 'waiting' ||
        phaseRef.current === 'playing' ||
        phaseRef.current === 'paused';

      if (!allowed) {
        scheduleManualHoldRef.current = false;
        setScheduleManualHold(false);
        if (queueActive) {
          void stopQueueRef.current();
        }
        return;
      }

      if (queueActive) {
        return;
      }

      if (
        phaseRef.current === 'idle' &&
        activeProfile.tracks.length > 0 &&
        !scheduleManualHoldRef.current
      ) {
        playRef.current();
      }
    };

    tick();
    const intervalId = setInterval(tick, 15_000);
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        tick();
      }
    });
    return () => {
      clearInterval(intervalId);
      appStateSubscription.remove();
    };
  }, [
    activeProfile,
    activeProfile?.settings.autoStartEnabled,
    activeProfile?.settings.autoStopEnabled,
    activeProfile?.settings.autoStartMinutes,
    activeProfile?.settings.autoStopMinutes,
    activeProfile?.tracks.length,
  ]);

  const isQueueRunning = phase === 'waiting' || phase === 'playing';

  const togglePlayback = useCallback(() => {
    if (isQueueRunning) {
      pause();
    } else {
      play();
    }
  }, [isQueueRunning, pause, play]);

  const skipToNext = useCallback(() => {
    if (!activeProfile || activeProfile.tracks.length === 0) {
      return;
    }

    const nextOrderIndex = getNextQueueIndex(
      playOrderRef.current,
      currentOrderIndexRef.current,
      activeProfile.settings.loop,
    );

    if (nextOrderIndex === null) {
      setPhase('idle');
      return;
    }

    playTrackAtOrderIndex(nextOrderIndex);
  }, [activeProfile, playTrackAtOrderIndex]);

  const skipToPrevious = useCallback(() => {
    if (!activeProfile || activeProfile.tracks.length === 0) {
      return;
    }

    const previous =
      currentOrderIndexRef.current > 0
        ? currentOrderIndexRef.current - 1
        : activeProfile.settings.loop
          ? playOrderRef.current.length - 1
          : 0;

    playTrackAtOrderIndex(previous);
  }, [activeProfile, playTrackAtOrderIndex]);

  const playTrackAt = useCallback(
    (trackIndex: number) => {
      if (!activeProfile) {
        return;
      }
      const orderIndex = playOrderRef.current.indexOf(trackIndex);
      if (orderIndex === -1) {
        return;
      }
      playTrackAtOrderIndex(orderIndex);
    },
    [activeProfile, playTrackAtOrderIndex],
  );

  const pickAndAddTracks = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: AUDIO_MIME_TYPES,
      copyToCacheDirectory: true,
      multiple: true,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    try {
      const imported: Track[] = [];
      for (const asset of result.assets) {
        const track = await persistTrack(asset.uri, asset.name);
        imported.push(track);
      }

      await updateActiveProfile((profile) => ({
        ...profile,
        tracks: [...profile.tracks, ...imported],
      }));
    } catch {
      Alert.alert('Ошибка', 'Не удалось добавить один или несколько файлов.');
    }
  }, [updateActiveProfile]);

  const removeTrack = useCallback(
    async (trackId: string) => {
      if (!activeProfile) {
        return;
      }

      const track = activeProfile.tracks.find((item) => item.id === trackId);
      if (!track) {
        return;
      }

      if (currentTrack?.id === trackId) {
        await stopPlayback();
        setPhase('idle');
        clearWaitingTimer();
      }

      await removeTrackFile(track.uri);
      await updateActiveProfile((profile) => ({
        ...profile,
        tracks: profile.tracks.filter((item) => item.id !== trackId),
      }));
    },
    [activeProfile, currentTrack?.id, stopPlayback, updateActiveProfile],
  );

  const moveTrack = useCallback(
    async (fromIndex: number, toIndex: number) => {
      if (!activeProfile || fromIndex === toIndex) {
        return;
      }

      await updateActiveProfile((profile) => {
        const tracks = [...profile.tracks];
        const [moved] = tracks.splice(fromIndex, 1);
        tracks.splice(toIndex, 0, moved);
        return { ...profile, tracks };
      });
    },
    [activeProfile, updateActiveProfile],
  );

  const updateSettings = useCallback(
    async (patch: Partial<ProfileSettings>) => {
      const normalized = { ...patch };
      if (normalized.maxIntervalSeconds !== undefined) {
        normalized.maxIntervalSeconds = Math.min(
          MAX_INTERVAL_SECONDS,
          Math.max(0, normalized.maxIntervalSeconds),
        );
      }
      if (normalized.volumePercent !== undefined) {
        normalized.volumePercent = Math.min(
          MAX_VOLUME_PERCENT,
          Math.max(MIN_VOLUME_PERCENT, normalized.volumePercent),
        );
        setPlaybackVolume(normalized.volumePercent);
        void applyVolumeToActiveSound();
      }
      if (normalized.autoStartMinutes !== undefined) {
        normalized.autoStartMinutes = normalizeMinutesOfDay(normalized.autoStartMinutes);
      }
      if (normalized.autoStopMinutes !== undefined) {
        normalized.autoStopMinutes = normalizeMinutesOfDay(normalized.autoStopMinutes);
      }
      await updateActiveProfile((profile) => ({
        ...profile,
        settings: { ...profile.settings, ...normalized },
      }));
    },
    [updateActiveProfile],
  );

  const createNewProfile = useCallback(
    async (name: string) => {
      if (!snapshot) {
        return;
      }
      const profile = createProfile(name.trim() || 'Новый профиль');
      await persistSnapshot({
        profiles: [...snapshot.profiles, profile],
        activeProfileId: profile.id,
      });
      setPhase('idle');
      setCurrentOrderIndex(0);
      clearWaitingTimer();
      await stopPlayback();
    },
    [persistSnapshot, snapshot, stopPlayback],
  );

  const renameProfile = useCallback(
    async (profileId: string, name: string) => {
      if (!snapshot) {
        return;
      }
      const profiles = snapshot.profiles.map((profile) =>
        profile.id === profileId ? { ...profile, name: name.trim() || profile.name, updatedAt: Date.now() } : profile,
      );
      await persistSnapshot({ ...snapshot, profiles });
    },
    [persistSnapshot, snapshot],
  );

  const deleteProfile = useCallback(
    async (profileId: string) => {
      if (!snapshot || snapshot.profiles.length <= 1) {
        Alert.alert('Нельзя удалить', 'Должен остаться хотя бы один профиль.');
        return;
      }

      const profile = snapshot.profiles.find((item) => item.id === profileId);
      if (!profile) {
        return;
      }

      for (const track of profile.tracks) {
        await removeTrackFile(track.uri);
      }

      const profiles = snapshot.profiles.filter((item) => item.id !== profileId);
      const activeProfileId =
        snapshot.activeProfileId === profileId ? profiles[0]?.id ?? null : snapshot.activeProfileId;

      await persistSnapshot({ profiles, activeProfileId });
      setPhase('idle');
      setCurrentOrderIndex(0);
      clearWaitingTimer();
      await stopPlayback();
    },
    [persistSnapshot, snapshot, stopPlayback],
  );

  const switchProfile = useCallback(
    async (profileId: string) => {
      if (!snapshot || snapshot.activeProfileId === profileId) {
        return;
      }
      await persistSnapshot({ ...snapshot, activeProfileId: profileId });
      setPhase('idle');
      setCurrentOrderIndex(0);
      clearWaitingTimer();
      await stopPlayback();
    },
    [persistSnapshot, snapshot, stopPlayback],
  );

  const duplicateProfile = useCallback(
    async (profileId: string) => {
      if (!snapshot) {
        return;
      }
      const source = snapshot.profiles.find((profile) => profile.id === profileId);
      if (!source) {
        return;
      }

      const copy = createProfile(`${source.name} (копия)`, source.settings);
      const tracks: Track[] = [];
      for (const track of source.tracks) {
        const imported = await persistTrack(track.uri, track.name);
        tracks.push(imported);
      }

      const profile: Profile = { ...copy, tracks };
      await persistSnapshot({
        profiles: [...snapshot.profiles, profile],
        activeProfileId: profile.id,
      });
    },
    [persistSnapshot, snapshot],
  );

  const value: AppContextValue = {
    isReady: snapshot !== null,
    profiles: snapshot?.profiles ?? [],
    activeProfile,
    activeProfileId: snapshot?.activeProfileId ?? null,
    phase,
    currentTrack,
    currentOrderIndex,
    playOrder,
    waitingSecondsLeft,
    waitingTotalSeconds,
    pendingNextOrderIndex,
    isPlaying: phase === 'playing' && playbackSnapshot.playing,
    isQueueRunning,
    isAutoScheduleEnabled,
    autoSchedulePlaybackAllowed,
    scheduleManualHold,
    schedule,
    playbackCurrentTime: playbackSnapshot.currentTime,
    playbackDuration: playbackSnapshot.duration,
    pickAndAddTracks,
    removeTrack,
    moveTrack,
    updateSettings,
    createNewProfile,
    renameProfile,
    deleteProfile,
    switchProfile,
    duplicateProfile,
    play,
    pause,
    togglePlayback,
    skipToNext,
    skipToPrevious,
    playTrackAt,
    playTrackAtOrderIndex,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
