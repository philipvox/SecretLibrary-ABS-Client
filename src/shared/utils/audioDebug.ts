/**
 * src/shared/utils/audioDebug.ts
 *
 * Comprehensive debug logging utility for audio playback.
 * Use these functions to diagnose audio issues across layers:
 * - Player Store (UI state management)
 * - Audio Service (TrackPlayer operations)
 * - Session Service (API/streaming)
 * - Progress Service (local persistence)
 * - Background Sync (server synchronization)
 */

const DEBUG = __DEV__;

// Track timing for performance analysis
const timings: Map<string, number> = new Map();
let lastLogTime = Date.now();
const appStartTime = Date.now();

// Get timestamp prefix showing ms since app start and ms since last log
const getTimestamp = (): string => {
  const now = Date.now();
  const sinceStart = now - appStartTime;
  const sinceLastLog = now - lastLogTime;
  lastLogTime = now;
  return `+${sinceLastLog}ms`;
};

/**
 * Audio debug logging utilities
 * Each category logs with a distinct prefix for easy filtering
 * Timestamps show ms since last log to help identify slow operations
 */
export const audioLog = {
  // Player Store - UI state and book loading
  store: (msg: string, ...args: any[]) =>
    DEBUG && console.log(`[Store ${getTimestamp()}] ${msg}`, ...args),

  // Audio Service - TrackPlayer operations
  audio: (msg: string, ...args: any[]) =>
    DEBUG && console.log(`[Audio ${getTimestamp()}] ${msg}`, ...args),

  // Session/API - Server communication
  session: (msg: string, ...args: any[]) =>
    DEBUG && console.log(`[Session ${getTimestamp()}] ${msg}`, ...args),

  // Progress - Local storage
  progress: (msg: string, ...args: any[]) =>
    DEBUG && console.log(`[Progress ${getTimestamp()}] ${msg}`, ...args),

  // Background Sync - Server sync
  sync: (msg: string, ...args: any[]) =>
    DEBUG && console.log(`[Sync ${getTimestamp()}] ${msg}`, ...args),

  // Errors (always log, even in production)
  error: (msg: string, ...args: any[]) =>
    console.error(`[Audio Error ${getTimestamp()}] ${msg}`, ...args),

  // Warnings (always log)
  warn: (msg: string, ...args: any[]) =>
    console.warn(`[Audio Warn ${getTimestamp()}] ${msg}`, ...args),

  // Timing - measure operation duration
  timing: (label: string, startTime: number) =>
    DEBUG && console.log(`[Timing] ${label}: ${Date.now() - startTime}ms`),

  // State transitions
  state: (from: string, to: string, context?: string) =>
    DEBUG && console.log(`[State ${getTimestamp()}] ${from} -> ${to}${context ? ` (${context})` : ''}`),

  // Network requests
  network: (method: string, url: string, status?: number) =>
    DEBUG && console.log(`[Network ${getTimestamp()}] ${method} ${url}${status !== undefined ? ` -> ${status}` : ''}`),
};

/**
 * Start a timing measurement
 * @param label Unique label for this timing
 */
export function startTiming(label: string): void {
  timings.set(label, Date.now());
}

/**
 * End a timing measurement and log the result
 * @param label The label used when starting the timing
 * @returns Duration in milliseconds, or -1 if timing wasn't started
 */
export function endTiming(label: string): number {
  const start = timings.get(label);
  if (start === undefined) {
    audioLog.warn(`Timing "${label}" was never started`);
    return -1;
  }

  const duration = Date.now() - start;
  timings.delete(label);
  audioLog.timing(label, start);
  return duration;
}

/**
 * Create a timing helper for a specific operation
 * Returns a function that logs elapsed time when called
 */
export function createTimer(operationName: string): (label: string) => void {
  const t0 = Date.now();
  return (label: string) => {
    audioLog.timing(`${operationName} - ${label}`, t0);
  };
}

/**
 * Log a separator for visual organization in console
 */
export function logSection(title: string): void {
  if (DEBUG) {
    console.log(`\n========== ${title} [${getTimestamp()}] ==========`);
  }
}

/**
 * Log an object with proper formatting
 */
export function logObject(label: string, obj: any): void {
  if (DEBUG) {
    console.log(`[Debug] ${label}:`, JSON.stringify(obj, null, 2));
  }
}

/**
 * Format seconds to HH:MM:SS timestamp format
 */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '00:00';

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * TrackPlayer state names for human-readable logging
 */
export const TrackPlayerStateNames: Record<number, string> = {
  0: 'None',
  1: 'Ready',
  2: 'Playing',
  3: 'Paused',
  4: 'Stopped',
  5: 'Buffering',
  6: 'Loading',
  7: 'Ended',
  8: 'Error',
};

/**
 * Get human-readable state name
 */
export function getStateName(stateNumber: number): string {
  return TrackPlayerStateNames[stateNumber] || `Unknown(${stateNumber})`;
}

/**
 * Validate URL format and log issues
 */
export function validateUrl(url: string | null | undefined, context: string): boolean {
  if (!url) {
    audioLog.error(`${context}: URL is empty or undefined`);
    return false;
  }

  if (typeof url !== 'string') {
    audioLog.error(`${context}: URL is not a string, got ${typeof url}`);
    return false;
  }

  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
    audioLog.error(`${context}: Invalid URL format - must start with http://, https://, or file://`);
    audioLog.error(`${context}: Got: ${url.substring(0, 100)}`);
    return false;
  }

  audioLog.audio(`${context}: URL valid (${url.length} chars)`);
  return true;
}

/**
 * Test URL accessibility (for debugging)
 * Note: Only works for http(s) URLs
 */
export async function testUrlAccessibility(url: string): Promise<{ accessible: boolean; status?: number; error?: string }> {
  if (!url.startsWith('http')) {
    return { accessible: true }; // Can't test file:// URLs this way
  }

  try {
    const response = await fetch(url, { method: 'HEAD' });
    audioLog.network('HEAD', url, response.status);
    return {
      accessible: response.ok,
      status: response.status,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error: any) {
    audioLog.network('HEAD', url);
    audioLog.error(`URL test failed: ${error.message}`);
    return { accessible: false, error: error.message };
  }
}

/**
 * Log chapter information for debugging
 */
export function logChapters(chapters: Array<{ start: number; end: number; title: string }>): void {
  if (!DEBUG) return;

  console.log('[Debug] Chapters:');
  chapters.forEach((ch, i) => {
    console.log(
      `  ${i}: ${formatDuration(ch.start)} - ${formatDuration(ch.end)} "${ch.title}"`
    );
  });
}

/**
 * Log audio track information for debugging
 */
export function logTracks(tracks: Array<{ url: string; startOffset: number; duration: number; title?: string }>): void {
  if (!DEBUG) return;

  console.log('[Debug] Audio Tracks:');
  tracks.forEach((track, i) => {
    console.log(
      `  ${i}: offset=${formatDuration(track.startOffset)}, duration=${formatDuration(track.duration)}, title="${track.title || 'Untitled'}"`
    );
    console.log(`       url=${track.url.substring(0, 80)}...`);
  });
}

/**
 * Create a debug context that can be passed around
 * Useful for tracing a single operation across multiple services
 */
export function createDebugContext(operationName: string): {
  id: string;
  log: (msg: string, ...args: any[]) => void;
  timing: (label: string) => void;
  startTime: number;
} {
  const id = `${operationName}-${Date.now().toString(36)}`;
  const startTime = Date.now();

  return {
    id,
    startTime,
    log: (msg: string, ...args: any[]) => {
      if (DEBUG) {
        console.log(`[${id}] ${msg}`, ...args);
      }
    },
    timing: (label: string) => {
      if (DEBUG) {
        console.log(`[${id}] ${label}: ${Date.now() - startTime}ms`);
      }
    },
  };
}

/**
 * Debug helper to trace position sources
 * Useful for diagnosing "wrong position" issues
 */
export function logPositionSources(sources: {
  trackPlayer?: number;
  store?: number;
  session?: number;
  localProgress?: number;
  finalPosition?: number;
}): void {
  if (!DEBUG) return;

  console.log('[Debug] Position sources:');
  if (sources.trackPlayer !== undefined) {
    console.log(`  - TrackPlayer: ${formatDuration(sources.trackPlayer)} (${sources.trackPlayer.toFixed(1)}s)`);
  }
  if (sources.store !== undefined) {
    console.log(`  - Store: ${formatDuration(sources.store)} (${sources.store.toFixed(1)}s)`);
  }
  if (sources.session !== undefined) {
    console.log(`  - Session: ${formatDuration(sources.session)} (${sources.session.toFixed(1)}s)`);
  }
  if (sources.localProgress !== undefined) {
    console.log(`  - LocalProgress: ${formatDuration(sources.localProgress)} (${sources.localProgress.toFixed(1)}s)`);
  }
  if (sources.finalPosition !== undefined) {
    console.log(`  => Final: ${formatDuration(sources.finalPosition)} (${sources.finalPosition.toFixed(1)}s)`);
  }
}

/**
 * Debug helper to trace duration sources
 */
export function logDurationSources(sources: {
  metadata?: number;
  audioFiles?: number;
  chapters?: number;
  session?: number;
  trackPlayer?: number;
  finalDuration?: number;
}): void {
  if (!DEBUG) return;

  console.log('[Debug] Duration sources:');
  if (sources.metadata !== undefined) {
    console.log(`  - Metadata: ${formatDuration(sources.metadata)}`);
  }
  if (sources.audioFiles !== undefined) {
    console.log(`  - Audio files sum: ${formatDuration(sources.audioFiles)}`);
  }
  if (sources.chapters !== undefined) {
    console.log(`  - Chapters end: ${formatDuration(sources.chapters)}`);
  }
  if (sources.session !== undefined) {
    console.log(`  - Session: ${formatDuration(sources.session)}`);
  }
  if (sources.trackPlayer !== undefined) {
    console.log(`  - TrackPlayer: ${formatDuration(sources.trackPlayer)}`);
  }
  if (sources.finalDuration !== undefined) {
    console.log(`  => Final: ${formatDuration(sources.finalDuration)}`);
  }
}
