/**
 * src/features/automotive/androidAutoBridge.ts
 *
 * Bridge for syncing browse data to native Android Auto MediaPlaybackService.
 *
 * Approach: Write JSON to a file in internal storage that both React Native
 * and native Android can access. MediaPlaybackService reads this file to
 * populate the browse tree.
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { BrowseSection } from './types';
import { audioLog } from '@/shared/utils/audioDebug';

const log = (...args: any[]) => audioLog.audio('[AndroidAutoBridge]', ...args);

// File path for browse data (in app's internal storage)
const BROWSE_DATA_FILENAME = 'android_auto_browse.json';

/**
 * Get the path to the browse data file
 */
function getBrowseDataPath(): string {
  return `${FileSystem.documentDirectory}${BROWSE_DATA_FILENAME}`;
}

/**
 * Write browse sections to file for Android Auto to read
 */
export async function updateAndroidAutoBrowseData(sections: BrowseSection[]): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const path = getBrowseDataPath();
    const data = JSON.stringify(sections, null, 2);

    await FileSystem.writeAsStringAsync(path, data, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    log('Browse data written to:', path);
    log('Sections:', sections.map(s => `${s.title} (${s.items.length} items)`).join(', '));
  } catch (error) {
    log('Failed to write browse data:', error);
  }
}

/**
 * Read browse sections from file (for debugging)
 */
export async function getAndroidAutoBrowseData(): Promise<BrowseSection[] | null> {
  if (Platform.OS !== 'android') return null;

  try {
    const path = getBrowseDataPath();
    const info = await FileSystem.getInfoAsync(path);

    if (!info.exists) {
      log('Browse data file does not exist');
      return null;
    }

    const data = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return JSON.parse(data) as BrowseSection[];
  } catch (error) {
    log('Failed to read browse data:', error);
    return null;
  }
}

/**
 * Clear browse data file
 */
export async function clearAndroidAutoBrowseData(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const path = getBrowseDataPath();
    const info = await FileSystem.getInfoAsync(path);

    if (info.exists) {
      await FileSystem.deleteAsync(path);
      log('Browse data cleared');
    }
  } catch (error) {
    log('Failed to clear browse data:', error);
  }
}
