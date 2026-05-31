import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type BoomLoudnessModule = {
  setTargetGainMilliBel(gainMilliBel: number): Promise<void>;
  release(): Promise<void>;
};

let nativeModule: BoomLoudnessModule | null | undefined;

function getNativeModule(): BoomLoudnessModule | null {
  if (Platform.OS !== 'android') {
    return null;
  }

  if (nativeModule !== undefined) {
    return nativeModule;
  }

  nativeModule = requireOptionalNativeModule<BoomLoudnessModule>('BoomLoudness');
  return nativeModule;
}

export function isVolumeBoostAvailable(): boolean {
  return getNativeModule() != null;
}

export async function setVolumeBoostGainMilliBel(gainMilliBel: number): Promise<void> {
  const module = getNativeModule();
  if (!module) {
    return;
  }

  await module.setTargetGainMilliBel(Math.max(0, Math.round(gainMilliBel)));
}

export async function releaseVolumeBoost(): Promise<void> {
  const module = getNativeModule();
  if (!module) {
    return;
  }

  await module.release();
}
