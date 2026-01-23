/**
 * Smart Rewind Utility
 *
 * Handles automatic rewind on resume based on pause duration.
 * Extracted from playerStore.ts for modularity.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Chapter } from '../types';

// =============================================================================
// CONSTANTS
// =============================================================================

const SMART_REWIND_PAUSE_TIMESTAMP_KEY = 'smartRewindPauseTimestamp';
const SMART_REWIND_PAUSE_BOOK_ID_KEY = 'smartRewindPauseBookId';
const SMART_REWIND_PAUSE_POSITION_KEY = 'smartRewindPausePosition';

// =============================================================================
// MODULE-LEVEL STATE
// =============================================================================

// In-memory tracking for smart rewind (also persisted for app restart)
let smartRewindPauseTimestamp: number | null = null;
let smartRewindPauseBookId: string | null = null;
let smartRewindPausePosition: number | null = null;

// Flag to prevent re-application of smart rewind in same session
// Even if AsyncStorage clear fails, this prevents double-rewind
let smartRewindAppliedThisSession: string | null = null;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get chapter start time for a position to prevent rewinding past chapter boundary
 */
export function getChapterStartForPosition(chapters: Chapter[], position: number): number {
  if (!chapters || chapters.length === 0) return 0;
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (chapters[i].start <= position) {
      return chapters[i].start;
    }
  }
  return 0;
}

// =============================================================================
// PERSISTENCE FUNCTIONS
// =============================================================================

/**
 * Persist smart rewind state for app restart scenarios
 */
export async function persistSmartRewindState(
  bookId: string,
  position: number,
  log: (msg: string) => void = () => {}
): Promise<void> {
  const now = Date.now();
  smartRewindPauseTimestamp = now;
  smartRewindPauseBookId = bookId;
  smartRewindPausePosition = position;
  // Reset the applied flag - new pause means smart rewind can apply on next resume
  smartRewindAppliedThisSession = null;

  try {
    await Promise.all([
      AsyncStorage.setItem(SMART_REWIND_PAUSE_TIMESTAMP_KEY, now.toString()),
      AsyncStorage.setItem(SMART_REWIND_PAUSE_BOOK_ID_KEY, bookId),
      AsyncStorage.setItem(SMART_REWIND_PAUSE_POSITION_KEY, position.toString()),
    ]);
  } catch (err) {
    log('[SmartRewind] Failed to persist pause state');
  }
}

/**
 * Restore smart rewind state from storage (for app restart)
 */
export async function restoreSmartRewindState(
  currentBookId: string,
  log: (msg: string) => void = () => {}
): Promise<{
  timestamp: number | null;
  position: number | null;
}> {
  // Check if smart rewind was already applied this session for this book
  // This prevents re-application even if AsyncStorage clear failed
  if (smartRewindAppliedThisSession === currentBookId) {
    log('[SmartRewind] Already applied this session, skipping');
    return { timestamp: null, position: null };
  }

  // First check in-memory state
  if (smartRewindPauseTimestamp && smartRewindPauseBookId === currentBookId) {
    return {
      timestamp: smartRewindPauseTimestamp,
      position: smartRewindPausePosition,
    };
  }

  // Try to restore from storage
  try {
    const [storedTimestamp, storedBookId, storedPosition] = await Promise.all([
      AsyncStorage.getItem(SMART_REWIND_PAUSE_TIMESTAMP_KEY),
      AsyncStorage.getItem(SMART_REWIND_PAUSE_BOOK_ID_KEY),
      AsyncStorage.getItem(SMART_REWIND_PAUSE_POSITION_KEY),
    ]);

    if (storedTimestamp && storedBookId === currentBookId) {
      return {
        timestamp: parseInt(storedTimestamp, 10),
        position: storedPosition ? parseFloat(storedPosition) : null,
      };
    }
  } catch (err) {
    log('[SmartRewind] Failed to restore pause state');
  }

  return { timestamp: null, position: null };
}

/**
 * Mark smart rewind as applied for this book in current session.
 * Prevents re-application even if AsyncStorage clear fails.
 */
export function markSmartRewindApplied(bookId: string): void {
  smartRewindAppliedThisSession = bookId;
}

/**
 * Clear smart rewind state
 */
export async function clearSmartRewindState(): Promise<void> {
  smartRewindPauseTimestamp = null;
  smartRewindPauseBookId = null;
  smartRewindPausePosition = null;
  // Note: Don't clear smartRewindAppliedThisSession here - it should persist
  // until a new pause event happens, preventing any re-application

  try {
    await Promise.all([
      AsyncStorage.removeItem(SMART_REWIND_PAUSE_TIMESTAMP_KEY),
      AsyncStorage.removeItem(SMART_REWIND_PAUSE_BOOK_ID_KEY),
      AsyncStorage.removeItem(SMART_REWIND_PAUSE_POSITION_KEY),
    ]);
  } catch {
    // Ignore cleanup errors - in-memory flag prevents re-application anyway
  }
}

/**
 * Get current in-memory smart rewind state (for debugging)
 */
export function getSmartRewindState() {
  return {
    timestamp: smartRewindPauseTimestamp,
    bookId: smartRewindPauseBookId,
    position: smartRewindPausePosition,
  };
}
