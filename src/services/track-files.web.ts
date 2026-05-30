import { createId } from '@/types/profile';

/** On web, files stay as blob URLs from the document picker (no persistent copy). */
export async function persistTrack(sourceUri: string, displayName: string) {
  return {
    id: createId(),
    uri: sourceUri,
    name: displayName,
  };
}

export async function removeTrackFile(_uri: string): Promise<void> {
  // Blob URLs are managed by the browser; nothing to delete on disk.
}
