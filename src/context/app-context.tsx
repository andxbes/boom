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
import { Alert } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import {
  buildPlayOrder,
  getNextQueueIndex,
  getRandomIntervalSeconds,
  getTrackAt,
  type PlayerPhase,
} from '@/services/queue';
import { buildSchedule, type ScheduleRow } from '@/services/schedule';
import { loadProfilesSnapshot, saveProfilesSnapshot } from '@/services/profile-storage';
import { persistTrack, removeTrackFile } from '@/services/track-files';
import {
  createProfile,
  MAX_INTERVAL_SECONDS,
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

  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  const phaseRef = useRef(phase);
  const playOrderRef = useRef(playOrder);
  const currentOrderIndexRef = useRef(currentOrderIndex);
  const waitingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitingEndsAtRef = useRef<number | null>(null);
  const finishHandledRef = useRef(false);

  phaseRef.current = phase;
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
            currentTime: status.currentTime,
            currentDuration: status.duration,
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
      status.currentTime,
      status.duration,
      waitingSecondsLeft,
      waitingTotalSeconds,
    ],
  );

  useEffect(() => {
    void (async () => {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      });
      const loaded = await loadProfilesSnapshot();
      setSnapshot(loaded);
      setPlayOrder(buildPlayOrder(loaded.profiles[0]?.tracks.length ?? 0, loaded.profiles[0]?.settings.shuffle ?? false));
    })();
  }, []);

  useEffect(() => {
    return () => {
      clearWaitingTimer();
    };
  }, []);

  useEffect(() => {
    if (!activeProfile) {
      return;
    }
    setPlayOrder(buildPlayOrder(activeProfile.tracks.length, activeProfile.settings.shuffle));
    setCurrentOrderIndex(0);
    setPhase('idle');
    clearWaitingTimer();
    player.pause();
  }, [activeProfile?.id]);

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
    if (!activeProfile || !currentTrack || !status.duration || status.duration <= 0) {
      return;
    }
    if (phaseRef.current !== 'playing') {
      return;
    }
    const rounded = Math.round(status.duration);
    if (currentTrack.durationSeconds === rounded) {
      return;
    }
    void updateActiveProfile((profile) => ({
      ...profile,
      tracks: profile.tracks.map((track) =>
        track.id === currentTrack.id ? { ...track, durationSeconds: rounded } : track,
      ),
    }));
  }, [activeProfile, currentTrack, status.duration, updateActiveProfile]);

  const clearWaitingTimer = () => {
    if (waitingTimerRef.current) {
      clearInterval(waitingTimerRef.current);
      waitingTimerRef.current = null;
    }
  };

  const syncWaitingSecondsLeft = () => {
    if (waitingEndsAtRef.current === null) {
      return 0;
    }
    return Math.max(0, Math.ceil((waitingEndsAtRef.current - Date.now()) / 1000));
  };

  const loadAndPlayTrack = useCallback(
    async (orderIndex: number, nextPlayOrder = playOrderRef.current) => {
      if (!activeProfile) {
        return;
      }
      const track = getTrackAt(nextPlayOrder, orderIndex, activeProfile.tracks);
      if (!track) {
        setPhase('idle');
        return;
      }

      setCurrentOrderIndex(orderIndex);
      setPhase('playing');
      clearWaitingTimer();
      waitingEndsAtRef.current = null;
      setWaitingSecondsLeft(0);
      setWaitingTotalSeconds(0);
      setPendingNextOrderIndex(null);

      player.replace(track.uri);
      player.loop = false;
      player.setActiveForLockScreen(true, {
        title: track.name,
        artist: activeProfile.name,
      });
      player.play();
    },
    [activeProfile, player],
  );

  const startWaitingTicker = useCallback(
    (orderIndex: number, secondsLeft: number, totalSeconds: number) => {
      const endsAtMs = Date.now() + secondsLeft * 1000;
      waitingEndsAtRef.current = endsAtMs;
      setPhase('waiting');
      setPendingNextOrderIndex(orderIndex);
      setWaitingSecondsLeft(secondsLeft);
      setWaitingTotalSeconds(totalSeconds);
      clearWaitingTimer();

      const tick = () => {
        const remaining = syncWaitingSecondsLeft();
        setWaitingSecondsLeft(remaining);
        if (remaining <= 0) {
          clearWaitingTimer();
          waitingEndsAtRef.current = null;
          void loadAndPlayTrack(orderIndex);
        }
      };

      tick();
      waitingTimerRef.current = setInterval(tick, 250);
    },
    [loadAndPlayTrack],
  );

  const resumeWaitingTimer = useCallback(
    (orderIndex: number, secondsLeft: number, totalSeconds?: number) => {
      startWaitingTicker(orderIndex, secondsLeft, totalSeconds ?? secondsLeft);
    },
    [startWaitingTicker],
  );

  const startWaitingForNext = useCallback(
    (nextOrderIndex: number) => {
      if (!activeProfile) {
        return;
      }

      const delaySeconds = getRandomIntervalSeconds(activeProfile.settings);
      if (delaySeconds <= 0) {
        void loadAndPlayTrack(nextOrderIndex);
        return;
      }

      resumeWaitingTimer(nextOrderIndex, delaySeconds, delaySeconds);
    },
    [activeProfile, loadAndPlayTrack, resumeWaitingTimer],
  );

  const startWaitingBeforeTrack = useCallback(
    (orderIndex: number) => {
      startWaitingForNext(orderIndex);
    },
    [startWaitingForNext],
  );

  const handleTrackFinished = useCallback(() => {
    if (!activeProfile) {
      setPhase('idle');
      return;
    }

    player.pause();

    const nextOrderIndex = getNextQueueIndex(
      playOrderRef.current,
      currentOrderIndexRef.current,
      activeProfile.settings.loop,
    );

    if (nextOrderIndex === null) {
      setPhase('idle');
      waitingEndsAtRef.current = null;
      setPendingNextOrderIndex(null);
      return;
    }

    startWaitingForNext(nextOrderIndex);
  }, [activeProfile, player, startWaitingForNext]);

  useEffect(() => {
    if (!status.didJustFinish || finishHandledRef.current) {
      return;
    }
    if (phaseRef.current !== 'playing') {
      return;
    }
    finishHandledRef.current = true;
    handleTrackFinished();
  }, [status.didJustFinish, handleTrackFinished]);

  useEffect(() => {
    if (status.playing && phaseRef.current === 'playing') {
      finishHandledRef.current = false;
    }
  }, [status.playing, currentTrack?.id]);

  const play = useCallback(() => {
    if (!activeProfile || activeProfile.tracks.length === 0) {
      return;
    }

    if (phaseRef.current === 'paused') {
      if (pendingNextOrderIndex !== null && waitingSecondsLeft > 0) {
        resumeWaitingTimer(pendingNextOrderIndex, waitingSecondsLeft, waitingTotalSeconds);
        return;
      }
      if (currentTrack) {
        player.play();
        setPhase('playing');
        return;
      }
    }

    if (phaseRef.current === 'idle') {
      startWaitingBeforeTrack(currentOrderIndexRef.current);
      return;
    }

    if (phaseRef.current === 'playing' && !status.playing) {
      player.play();
      setPhase('playing');
    }
  }, [
    activeProfile,
    pendingNextOrderIndex,
    waitingSecondsLeft,
    waitingTotalSeconds,
    resumeWaitingTimer,
    currentTrack,
    player,
    startWaitingBeforeTrack,
    status.playing,
  ]);

  const pause = useCallback(() => {
    if (phaseRef.current === 'waiting') {
      clearWaitingTimer();
      const remaining = syncWaitingSecondsLeft();
      setWaitingSecondsLeft(remaining);
      waitingEndsAtRef.current = null;
      setPhase('paused');
      return;
    }
    if (phaseRef.current === 'playing') {
      player.pause();
      setPhase('paused');
    }
  }, [player]);

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

    clearWaitingTimer();
    player.pause();

    const nextOrderIndex = getNextQueueIndex(
      playOrderRef.current,
      currentOrderIndexRef.current,
      activeProfile.settings.loop,
    );

    if (nextOrderIndex === null) {
      setPhase('idle');
      return;
    }

    void loadAndPlayTrack(nextOrderIndex);
  }, [activeProfile, loadAndPlayTrack, player]);

  const skipToPrevious = useCallback(() => {
    if (!activeProfile || activeProfile.tracks.length === 0) {
      return;
    }

    clearWaitingTimer();
    player.pause();

    const previous =
      currentOrderIndexRef.current > 0
        ? currentOrderIndexRef.current - 1
        : activeProfile.settings.loop
          ? playOrderRef.current.length - 1
          : 0;

    void loadAndPlayTrack(previous);
  }, [activeProfile, loadAndPlayTrack, player]);

  const playTrackAtOrderIndex = useCallback(
    (orderIndex: number) => {
      if (!activeProfile) {
        return;
      }
      clearWaitingTimer();
      player.pause();
      void loadAndPlayTrack(orderIndex);
    },
    [activeProfile, loadAndPlayTrack, player],
  );

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
        player.pause();
        setPhase('idle');
        clearWaitingTimer();
      }

      await removeTrackFile(track.uri);
      await updateActiveProfile((profile) => ({
        ...profile,
        tracks: profile.tracks.filter((item) => item.id !== trackId),
      }));
    },
    [activeProfile, currentTrack?.id, player, updateActiveProfile],
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
      player.pause();
    },
    [persistSnapshot, player, snapshot],
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
      player.pause();
    },
    [persistSnapshot, player, snapshot],
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
      player.pause();
    },
    [persistSnapshot, player, snapshot],
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
    isPlaying: phase === 'playing' && status.playing,
    isQueueRunning,
    schedule,
    playbackCurrentTime: status.currentTime,
    playbackDuration: status.duration,
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
