/**
 * Listening Session Tracking Utility
 *
 * Tracks listening sessions for stats and analytics.
 * Extracted from playerStore.ts for modularity.
 */

import { LibraryItem, BookMetadata } from '@/core/types';
import { sqliteCache } from '@/core/services/sqliteCache';

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_SESSION_DURATION = 10; // Minimum 10 seconds to record a session

// =============================================================================
// MODULE-LEVEL STATE
// =============================================================================

// Track active listening session
let activeSession: {
  bookId: string;
  bookTitle: string;
  startTimestamp: number;
  startPosition: number;
} | null = null;

// =============================================================================
// SESSION FUNCTIONS
// =============================================================================

/**
 * Start tracking a new listening session
 */
export function startListeningSession(
  book: LibraryItem,
  position: number,
  log: (msg: string) => void = () => {}
): void {
  const title = (book.media?.metadata as BookMetadata)?.title || 'Unknown Title';
  activeSession = {
    bookId: book.id,
    bookTitle: title,
    startTimestamp: Date.now(),
    startPosition: position,
  };
  log(`[ListeningStats] Session started for "${title}" at ${position.toFixed(1)}s`);
}

/**
 * End the current listening session and record it to SQLite
 */
export async function endListeningSession(
  endPosition: number,
  log: (msg: string) => void = () => {},
  logError: (msg: string, ...args: any[]) => void = () => {}
): Promise<void> {
  if (!activeSession) return;

  const endTimestamp = Date.now();
  const durationSeconds = Math.round((endTimestamp - activeSession.startTimestamp) / 1000);

  // Only record sessions >= minimum duration
  if (durationSeconds < MIN_SESSION_DURATION) {
    log(`[ListeningStats] Session too short (${durationSeconds}s < ${MIN_SESSION_DURATION}s), not recording`);
    activeSession = null;
    return;
  }

  try {
    await sqliteCache.recordListeningSession({
      bookId: activeSession.bookId,
      bookTitle: activeSession.bookTitle,
      startTimestamp: activeSession.startTimestamp,
      endTimestamp,
      durationSeconds,
      startPosition: activeSession.startPosition,
      endPosition,
    });
    log(`[ListeningStats] Session recorded: ${durationSeconds}s for "${activeSession.bookTitle}"`);
  } catch (err) {
    logError('[ListeningStats] Failed to record session:', err);
  }

  // If no server session is active, accumulate listening time for later sync.
  // Pure offline playback never opens a server session, so without this the
  // server's listening stats would miss all offline-only listening.
  try {
    const { sessionService } = await import('../services/sessionService');
    if (!sessionService.getCurrentSession()) {
      await sqliteCache.incrementOfflineListeningTime(activeSession.bookId, durationSeconds);
      log(`[ListeningStats] No server session — accumulated ${durationSeconds}s offline listening time`);
    }
  } catch (err) {
    // Best-effort — don't let this break session cleanup
  }

  activeSession = null;
}

/**
 * Check if there's an active listening session
 */
export function hasActiveSession(): boolean {
  return activeSession !== null;
}

/**
 * Get the current active session info (for debugging)
 */
export function getActiveSession() {
  return activeSession ? { ...activeSession } : null;
}

/**
 * Force clear the active session without recording
 * (Use sparingly - e.g., on logout or cleanup)
 */
export function clearActiveSession(): void {
  activeSession = null;
}
