import * as FileSystem from 'expo-file-system/legacy';

import { createId } from '@/types/profile';

const TRACKS_DIR = `${FileSystem.documentDirectory}tracks/`;

async function ensureTracksDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(TRACKS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(TRACKS_DIR, { intermediates: true });
  }
}

export async function persistTrack(sourceUri: string, displayName: string) {
  await ensureTracksDir();
  const id = createId();
  const extension = getExtension(displayName);
  const destination = `${TRACKS_DIR}${id}${extension}`;

  await FileSystem.copyAsync({ from: sourceUri, to: destination });

  return {
    id,
    uri: destination,
    name: displayName,
  };
}

export async function removeTrackFile(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}

function getExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot === -1) {
    return '.mp3';
  }
  return name.slice(dot);
}
