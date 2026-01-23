/**
 * src/features/automotive/androidAutoBridge.ts
 *
 * Bridge for syncing browse data to native Android Auto MediaBrowserService.
 *
 * Uses native AndroidAutoModule to write browse data to a location
 * accessible by both React Native and the native MediaBrowserService.
 */

import { Platform, NativeModules } from 'react-native';
import { BrowseSection } from './types';
import { audioLog } from '@/shared/utils/audioDebug';

const log = (...args: any[]) => audioLog.audio('[AndroidAutoBridge]', ...args);

// Get the native module
const { AndroidAutoModule } = NativeModules;

/**
 * Write browse sections via native module for Android Auto to read
 */
export async function updateAndroidAutoBrowseData(sections: BrowseSection[]): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const data = JSON.stringify(sections);

    if (AndroidAutoModule?.writeBrowseData) {
      // Use native module to write to correct location
      await AndroidAutoModule.writeBrowseData(data);
      log('Browse data written via native module');
    } else {
      // Fallback for when native module isn't available yet
      log('AndroidAutoModule not available, browse data not written');
    }

    log('Sections:', sections.map(s => `${s.title} (${s.items.length} items)`).join(', '));
  } catch (error) {
    log('Failed to write browse data:', error);
  }
}

/**
 * Notify native service that browse data has been updated
 */
export function notifyBrowseDataUpdated(): void {
  if (Platform.OS !== 'android') return;

  try {
    AndroidAutoModule?.notifyBrowseDataUpdated?.();
  } catch (error) {
    log('Failed to notify browse data update:', error);
  }
}

/**
 * Update playback state in native MediaSession
 */
export function updatePlaybackState(
  isPlaying: boolean,
  position: number,
  speed: number
): void {
  if (Platform.OS !== 'android') return;

  try {
    AndroidAutoModule?.updatePlaybackState?.(isPlaying, position, speed);
  } catch (error) {
    log('Failed to update playback state:', error);
  }
}

/**
 * Update metadata in native MediaSession
 */
export function updateMetadata(
  title: string,
  author: string,
  duration: number,
  artworkUrl?: string | null
): void {
  if (Platform.OS !== 'android') return;

  try {
    AndroidAutoModule?.updateMetadata?.(title, author, duration, artworkUrl || null);
  } catch (error) {
    log('Failed to update metadata:', error);
  }
}

/**
 * Check if Android Auto is connected
 */
export async function isAndroidAutoConnected(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    if (AndroidAutoModule?.isConnected) {
      return await AndroidAutoModule.isConnected();
    }
    return false;
  } catch (error) {
    log('Failed to check Android Auto connection:', error);
    return false;
  }
}

/**
 * Clear browse data (for cleanup)
 */
export async function clearAndroidAutoBrowseData(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    // Write empty array to clear
    await updateAndroidAutoBrowseData([]);
    log('Browse data cleared');
  } catch (error) {
    log('Failed to clear browse data:', error);
  }
}
