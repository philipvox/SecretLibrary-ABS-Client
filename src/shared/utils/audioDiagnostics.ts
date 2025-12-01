/**
 * src/shared/utils/audioDiagnostics.ts
 *
 * Quick diagnostic script for audio playback issues.
 * Run this to get a snapshot of the current audio state across all layers.
 *
 * Usage:
 *   import { runAudioDiagnostics } from '@/shared/utils/audioDiagnostics';
 *   runAudioDiagnostics();
 *
 * Or add a debug button in your UI:
 *   <Button title="Diagnose Audio" onPress={runAudioDiagnostics} />
 */

import TrackPlayer, { State } from 'react-native-track-player';
import * as FileSystem from 'expo-file-system';
import { getStateName, formatDuration, formatBytes } from './audioDebug';

/**
 * Comprehensive audio diagnostics
 * Logs the current state of all audio-related systems
 */
export async function runAudioDiagnostics(): Promise<void> {
  console.log('\n========== AUDIO DIAGNOSTICS ==========');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // 1. TrackPlayer State
  await diagnoseTrackPlayer();

  // 2. Player Store State
  diagnosePlayerStore();

  // 3. Session State
  diagnoseSession();

  // 4. Progress Service State
  await diagnoseProgress();

  // 5. Background Sync State
  diagnoseBackgroundSync();

  // 6. File System
  await diagnoseFileSystem();

  // 7. Downloads
  diagnoseDownloads();

  console.log('========================================\n');
}

/**
 * Diagnose TrackPlayer state
 */
async function diagnoseTrackPlayer(): Promise<void> {
  console.log('\n--- TrackPlayer ---');

  try {
    const state = await TrackPlayer.getPlaybackState();
    const progress = await TrackPlayer.getProgress();
    const queue = await TrackPlayer.getQueue();
    const rate = await TrackPlayer.getRate();
    const activeIndex = await TrackPlayer.getActiveTrackIndex();
    const volume = await TrackPlayer.getVolume();

    console.log(`  State: ${getStateName(state.state)} (${state.state})`);
    console.log(`  Position: ${formatDuration(progress.position)} (${progress.position.toFixed(1)}s)`);
    console.log(`  Duration: ${formatDuration(progress.duration)} (${progress.duration.toFixed(1)}s)`);
    console.log(`  Buffered: ${formatDuration(progress.buffered)} (${progress.buffered.toFixed(1)}s)`);
    console.log(`  Rate: ${rate}x`);
    console.log(`  Volume: ${(volume * 100).toFixed(0)}%`);
    console.log(`  Queue length: ${queue.length}`);
    console.log(`  Active track index: ${activeIndex}`);

    if (queue.length > 0 && activeIndex !== undefined) {
      const currentTrack = queue[activeIndex];
      console.log(`  Current track:`);
      console.log(`    ID: ${currentTrack.id}`);
      console.log(`    Title: ${currentTrack.title}`);
      console.log(`    URL: ${currentTrack.url?.substring(0, 80)}...`);
    }

    // Log all tracks if multi-file
    if (queue.length > 1) {
      console.log(`  All tracks in queue:`);
      queue.forEach((track, i) => {
        const marker = i === activeIndex ? '>' : ' ';
        console.log(`   ${marker}${i}: ${track.title || track.id}`);
      });
    }
  } catch (e: any) {
    console.log(`  Error: TrackPlayer not initialized - ${e.message}`);
  }
}

/**
 * Diagnose Player Store state
 */
function diagnosePlayerStore(): void {
  console.log('\n--- PlayerStore ---');

  try {
    // Dynamic import to avoid circular dependencies
    const { usePlayerStore } = require('@/features/player/stores/playerStore');
    const state = usePlayerStore.getState();

    console.log(`  Current book: ${state.currentBook?.id || 'none'}`);
    if (state.currentBook) {
      console.log(`    Title: ${state.currentBook.media?.metadata?.title || 'Unknown'}`);
    }
    console.log(`  Is playing: ${state.isPlaying}`);
    console.log(`  Is loading: ${state.isLoading}`);
    console.log(`  Is buffering: ${state.isBuffering}`);
    console.log(`  Is offline: ${state.isOffline}`);
    console.log(`  Is player visible: ${state.isPlayerVisible}`);
    console.log(`  Position: ${formatDuration(state.position)} (${state.position.toFixed(1)}s)`);
    console.log(`  Duration: ${formatDuration(state.duration)} (${state.duration.toFixed(1)}s)`);
    console.log(`  Progress: ${((state.position / state.duration) * 100 || 0).toFixed(1)}%`);
    console.log(`  Chapters: ${state.chapters.length}`);
    console.log(`  Playback rate: ${state.playbackRate}x`);
    console.log(`  Sleep timer: ${state.sleepTimer !== null ? `${state.sleepTimer}s remaining` : 'off'}`);
    console.log(`  Bookmarks: ${state.bookmarks.length}`);

    // Current chapter
    const currentChapter = state.getCurrentChapter();
    if (currentChapter) {
      console.log(`  Current chapter: "${currentChapter.title}" (${formatDuration(currentChapter.start)} - ${formatDuration(currentChapter.end)})`);
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }
}

/**
 * Diagnose Session state
 */
function diagnoseSession(): void {
  console.log('\n--- Session ---');

  try {
    const { sessionService } = require('@/features/player/services/sessionService');
    const session = sessionService.getCurrentSession();

    console.log(`  Active: ${!!session}`);
    if (session) {
      console.log(`  Session ID: ${session.id}`);
      console.log(`  Library Item ID: ${session.libraryItemId}`);
      console.log(`  Media type: ${session.mediaType}`);
      console.log(`  Duration: ${formatDuration(session.duration)}`);
      console.log(`  Current time: ${formatDuration(session.currentTime)}`);
      console.log(`  Audio tracks: ${session.audioTracks?.length || 0}`);
      console.log(`  Chapters: ${session.chapters?.length || 0}`);

      if (session.audioTracks?.length) {
        console.log(`  First track URL: ${session.audioTracks[0].contentUrl?.substring(0, 60)}...`);
      }

      // Get stream URL
      const streamUrl = sessionService.getStreamUrl();
      if (streamUrl) {
        console.log(`  Stream URL available: Yes (${streamUrl.length} chars)`);
        console.log(`  Stream URL preview: ${streamUrl.substring(0, 80)}...`);
      } else {
        console.log(`  Stream URL available: No`);
      }
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }
}

/**
 * Diagnose Progress service state
 */
async function diagnoseProgress(): Promise<void> {
  console.log('\n--- Progress Service ---');

  try {
    const { progressService } = require('@/features/player/services/progressService');
    const { usePlayerStore } = require('@/features/player/stores/playerStore');
    const currentBook = usePlayerStore.getState().currentBook;

    if (currentBook) {
      const localProgress = await progressService.getLocalProgress(currentBook.id);
      const progressData = await progressService.getProgressData(currentBook.id);

      console.log(`  Local progress for current book: ${formatDuration(localProgress)}`);
      if (progressData) {
        console.log(`    Duration: ${formatDuration(progressData.duration)}`);
        console.log(`    Progress: ${(progressData.progress * 100).toFixed(1)}%`);
        console.log(`    Is finished: ${progressData.isFinished}`);
        console.log(`    Updated at: ${progressData.updatedAt ? new Date(progressData.updatedAt).toISOString() : 'unknown'}`);
      }
    }

    // Check for unsynced progress
    const unsyncedList = await progressService.getUnsyncedProgress();
    console.log(`  Unsynced progress entries: ${unsyncedList.length}`);
    if (unsyncedList.length > 0 && unsyncedList.length <= 5) {
      unsyncedList.forEach((p: any) => {
        console.log(`    - ${p.itemId}: ${formatDuration(p.currentTime)}`);
      });
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }
}

/**
 * Diagnose Background Sync state
 */
function diagnoseBackgroundSync(): void {
  console.log('\n--- Background Sync ---');

  try {
    const { backgroundSyncService } = require('@/features/player/services/backgroundSyncService');
    const status = backgroundSyncService.getStatus();

    console.log(`  Is running: ${status.isRunning}`);
    console.log(`  Queue size: ${status.queueSize}`);
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }
}

/**
 * Diagnose File System
 */
async function diagnoseFileSystem(): Promise<void> {
  console.log('\n--- File System ---');

  console.log(`  Document dir: ${FileSystem.documentDirectory}`);
  console.log(`  Cache dir: ${FileSystem.cacheDirectory}`);

  // Check downloads directory
  const downloadsDir = `${FileSystem.documentDirectory}downloads/`;
  try {
    const info = await FileSystem.getInfoAsync(downloadsDir);
    if (info.exists) {
      console.log(`  Downloads dir exists: Yes`);
      // List files (limit to 10)
      const files = await FileSystem.readDirectoryAsync(downloadsDir);
      console.log(`  Downloaded files: ${files.length}`);
      if (files.length > 0 && files.length <= 10) {
        for (const file of files) {
          const fileInfo = await FileSystem.getInfoAsync(`${downloadsDir}${file}`);
          const size = (fileInfo as any).size || 0;
          console.log(`    - ${file}: ${formatBytes(size)}`);
        }
      }
    } else {
      console.log(`  Downloads dir exists: No`);
    }
  } catch (e: any) {
    console.log(`  Downloads dir error: ${e.message}`);
  }
}

/**
 * Diagnose Downloads
 */
function diagnoseDownloads(): void {
  console.log('\n--- Downloads ---');

  try {
    const { autoDownloadService } = require('@/features/downloads');
    const allDownloads = autoDownloadService.getAllDownloads();

    console.log(`  Total downloads: ${allDownloads.length}`);

    if (allDownloads.length > 0 && allDownloads.length <= 10) {
      allDownloads.forEach((dl: any) => {
        const status = dl.status || 'unknown';
        const progress = dl.progress ? `${(dl.progress * 100).toFixed(0)}%` : '';
        console.log(`    - ${dl.bookId}: ${status} ${progress}`);
      });
    }

    // Check if current book is downloaded
    const { usePlayerStore } = require('@/features/player/stores/playerStore');
    const currentBook = usePlayerStore.getState().currentBook;
    if (currentBook) {
      const isDownloading = autoDownloadService.isDownloading(currentBook.id);
      const localPath = autoDownloadService.getLocalPath(currentBook.id);
      console.log(`  Current book download status:`);
      console.log(`    Is downloading: ${isDownloading}`);
      console.log(`    Local path: ${localPath || 'none'}`);
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message}`);
  }
}

/**
 * Quick status check - returns a summary object instead of logging
 * Useful for programmatic checks
 */
export async function getAudioStatus(): Promise<{
  trackPlayer: {
    initialized: boolean;
    state?: string;
    position?: number;
    duration?: number;
    isPlaying?: boolean;
  };
  playerStore: {
    hasBook: boolean;
    bookId?: string;
    isPlaying: boolean;
    isLoading: boolean;
    position: number;
    duration: number;
  };
  session: {
    active: boolean;
    sessionId?: string;
  };
  sync: {
    running: boolean;
    queueSize: number;
  };
}> {
  const result: any = {
    trackPlayer: { initialized: false },
    playerStore: { hasBook: false, isPlaying: false, isLoading: false, position: 0, duration: 0 },
    session: { active: false },
    sync: { running: false, queueSize: 0 },
  };

  // TrackPlayer
  try {
    const state = await TrackPlayer.getPlaybackState();
    const progress = await TrackPlayer.getProgress();
    result.trackPlayer = {
      initialized: true,
      state: getStateName(state.state),
      position: progress.position,
      duration: progress.duration,
      isPlaying: state.state === State.Playing,
    };
  } catch {
    result.trackPlayer.initialized = false;
  }

  // PlayerStore
  try {
    const { usePlayerStore } = require('@/features/player/stores/playerStore');
    const state = usePlayerStore.getState();
    result.playerStore = {
      hasBook: !!state.currentBook,
      bookId: state.currentBook?.id,
      isPlaying: state.isPlaying,
      isLoading: state.isLoading,
      position: state.position,
      duration: state.duration,
    };
  } catch {}

  // Session
  try {
    const { sessionService } = require('@/features/player/services/sessionService');
    const session = sessionService.getCurrentSession();
    result.session = {
      active: !!session,
      sessionId: session?.id,
    };
  } catch {}

  // Sync
  try {
    const { backgroundSyncService } = require('@/features/player/services/backgroundSyncService');
    const status = backgroundSyncService.getStatus();
    result.sync = status;
  } catch {}

  return result;
}

/**
 * Test URL accessibility for debugging streaming issues
 */
export async function testStreamUrl(): Promise<void> {
  console.log('\n--- Stream URL Test ---');

  try {
    const { sessionService } = require('@/features/player/services/sessionService');
    const streamUrl = sessionService.getStreamUrl();

    if (!streamUrl) {
      console.log('  No stream URL available (no active session?)');
      return;
    }

    console.log(`  Testing URL: ${streamUrl.substring(0, 80)}...`);

    const startTime = Date.now();
    const response = await fetch(streamUrl, { method: 'HEAD' });
    const elapsed = Date.now() - startTime;

    console.log(`  Response status: ${response.status}`);
    console.log(`  Response time: ${elapsed}ms`);
    console.log(`  Content-Type: ${response.headers.get('content-type')}`);
    console.log(`  Content-Length: ${formatBytes(parseInt(response.headers.get('content-length') || '0', 10))}`);

    if (!response.ok) {
      console.log(`  ERROR: URL not accessible (${response.status})`);
    } else {
      console.log(`  SUCCESS: URL is accessible`);
    }
  } catch (e: any) {
    console.log(`  ERROR: ${e.message}`);
  }
}

/**
 * Monitor playback state changes in real-time
 * Call stopPlaybackMonitor() to stop
 */
let playbackMonitorInterval: NodeJS.Timeout | null = null;
let lastMonitoredState: number | null = null;

export function startPlaybackMonitor(): void {
  if (playbackMonitorInterval) {
    console.log('[Monitor] Already running');
    return;
  }

  console.log('[Monitor] Starting playback monitor...');
  lastMonitoredState = null;

  playbackMonitorInterval = setInterval(async () => {
    try {
      const state = await TrackPlayer.getPlaybackState();
      const progress = await TrackPlayer.getProgress();

      // Only log state changes
      if (state.state !== lastMonitoredState) {
        console.log(`[Monitor] State: ${getStateName(lastMonitoredState || 0)} -> ${getStateName(state.state)}`);
        lastMonitoredState = state.state;
      }

      // Log position every 10 seconds
      if (Math.floor(progress.position) % 10 === 0) {
        console.log(`[Monitor] Position: ${formatDuration(progress.position)} / ${formatDuration(progress.duration)}`);
      }
    } catch {
      // Ignore errors
    }
  }, 1000);
}

export function stopPlaybackMonitor(): void {
  if (playbackMonitorInterval) {
    clearInterval(playbackMonitorInterval);
    playbackMonitorInterval = null;
    console.log('[Monitor] Stopped');
  }
}
