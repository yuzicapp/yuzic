import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * The photo behind Home: picked once and kept in the app's own storage.
 *
 * Picked through the document picker rather than an image picker, which the
 * app does not ship, and copied out of the picker's cache, which the system is
 * free to clear. The copy gets a fresh name each time so an image that changed
 * on disk is never shown from a stale cache entry.
 */

const DIRECTORY = `${FileSystem.documentDirectory}theme/`;

/** Let the user pick a photo and keep a copy of it. Null if they cancelled. */
export async function pickBackgroundImage(): Promise<string | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: 'image/*', copyToCacheDirectory: true });
  if (picked.canceled || !picked.assets?.[0]) return null;
  const asset = picked.assets[0];
  const extension = /\.[a-z0-9]+$/i.exec(asset.name)?.[0] ?? '.jpg';
  await FileSystem.makeDirectoryAsync(DIRECTORY, { intermediates: true });
  const target = `${DIRECTORY}background-${Date.now()}${extension}`;
  await FileSystem.copyAsync({ from: asset.uri, to: target });
  return target;
}

/** Delete a copy made by `pickBackgroundImage`. Anything else is left alone. */
export async function removeBackgroundImage(uri: string): Promise<void> {
  if (!uri.startsWith(DIRECTORY)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true });
}
