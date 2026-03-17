/**
 * Test utilities for playerStore integration tests.
 *
 * Provides mock factories, state builders, and helpers
 * for testing the player store in isolation.
 */

import { AudioTrackInfo, Chapter } from '../../utils/types';

// =============================================================================
// Mock Audio Player
// =============================================================================

export interface MockAudioPlayer {
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
  setRate: jest.Mock;
  stop: jest.Mock;
  unload: jest.Mock;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  rate: number;
  isLoaded: boolean;
}

export function createMockAudioPlayer(
  overrides: Partial<MockAudioPlayer> = {}
): MockAudioPlayer {
  return {
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    seekTo: jest.fn().mockResolvedValue(undefined),
    setRate: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    unload: jest.fn().mockResolvedValue(undefined),
    currentTime: 0,
    duration: 3600,
    isPlaying: false,
    rate: 1.0,
    isLoaded: false,
    ...overrides,
  };
}

// =============================================================================
// Mock Data Factories
// =============================================================================

export function createMockTrack(
  overrides: Partial<AudioTrackInfo> = {}
): AudioTrackInfo {
  return {
    url: 'https://example.com/track.mp3',
    title: 'Test Track',
    startOffset: 0,
    duration: 1800,
    ...overrides,
  };
}

export function createMockTracks(count: number): AudioTrackInfo[] {
  return Array.from({ length: count }, (_, i) => ({
    url: `https://example.com/track${i + 1}.mp3`,
    title: `Track ${i + 1}`,
    startOffset: i * 1800,
    duration: 1800,
  }));
}

export function createMockChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: 1,
    title: 'Chapter 1',
    start: 0,
    end: 1800,
    ...overrides,
  };
}

export function createMockChapters(count: number): Chapter[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Chapter ${i + 1}`,
    start: i * 1800,
    end: (i + 1) * 1800,
  }));
}

export interface MockBookMedia {
  libraryItemId: string;
  title: string;
  authorName: string;
  coverUrl: string | null;
  tracks: AudioTrackInfo[];
  chapters: Chapter[];
  duration: number;
}

export function createMockBookMedia(
  overrides: Partial<MockBookMedia> = {}
): MockBookMedia {
  const tracks = overrides.tracks || createMockTracks(3);
  const chapters = overrides.chapters || createMockChapters(5);
  const duration =
    overrides.duration || tracks.reduce((sum, t) => sum + t.duration, 0);

  return {
    libraryItemId: 'test-book-id',
    title: 'Test Audiobook',
    authorName: 'Test Author',
    coverUrl: 'https://example.com/cover.jpg',
    tracks,
    chapters,
    duration,
    ...overrides,
  };
}

// =============================================================================
// State Builders
// =============================================================================

export interface InitialPlayerState {
  isPlaying: boolean;
  position: number;
  duration: number;
  playbackRate: number;
  currentTrackIndex: number;
  isSeeking: boolean;
  seekPosition: number | null;
  bookId: string | null;
}

export function createInitialPlayerState(
  overrides: Partial<InitialPlayerState> = {}
): InitialPlayerState {
  return {
    isPlaying: false,
    position: 0,
    duration: 5400,
    playbackRate: 1.0,
    currentTrackIndex: 0,
    isSeeking: false,
    seekPosition: null,
    bookId: null,
    ...overrides,
  };
}

// =============================================================================
// Time Helpers
// =============================================================================

/**
 * Advance Jest timers and flush promises.
 */
export async function advanceTimersAndFlush(ms: number): Promise<void> {
  jest.advanceTimersByTime(ms);
  await flushPromises();
}

/**
 * Flush all pending promises.
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Wait for condition to be true (with timeout).
 */
export async function waitFor(
  condition: () => boolean,
  timeout: number = 1000,
  interval: number = 10
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`waitFor timed out after ${timeout}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

// =============================================================================
// Assertion Helpers
// =============================================================================

/**
 * Assert that a function was called with specific arguments.
 */
export function expectCalledWith(
  mockFn: jest.Mock,
  ...args: unknown[]
): void {
  expect(mockFn).toHaveBeenCalledWith(...args);
}

/**
 * Assert that a function was called n times.
 */
export function expectCallCount(mockFn: jest.Mock, count: number): void {
  expect(mockFn).toHaveBeenCalledTimes(count);
}

/**
 * Assert position is within tolerance.
 */
export function expectPositionNear(
  actual: number,
  expected: number,
  tolerance: number = 0.5
): void {
  expect(actual).toBeGreaterThanOrEqual(expected - tolerance);
  expect(actual).toBeLessThanOrEqual(expected + tolerance);
}

// =============================================================================
// Store Reset Helper
// =============================================================================

/**
 * Reset all mocks and timers.
 */
export function resetTestEnvironment(): void {
  jest.clearAllMocks();
  jest.clearAllTimers();
}

// =============================================================================
// Playback Simulation
// =============================================================================

export interface PlaybackSimulator {
  player: MockAudioPlayer;
  advancePlayback: (seconds: number) => void;
  simulateTrackEnd: () => void;
  simulateError: (error: Error) => void;
  simulateBuffering: (isBuffering: boolean) => void;
}

export function createPlaybackSimulator(): PlaybackSimulator {
  const player = createMockAudioPlayer();

  return {
    player,

    advancePlayback(seconds: number): void {
      player.currentTime += seconds;
    },

    simulateTrackEnd(): void {
      player.currentTime = player.duration;
    },

    simulateError(_error: Error): void {
      // Trigger error callback if registered
      // This would be used with actual audio service integration
    },

    simulateBuffering(_isBuffering: boolean): void {
      // Trigger buffering state change
    },
  };
}

// =============================================================================
// Seek Testing Helpers
// =============================================================================

export interface SeekTestScenario {
  name: string;
  initialPosition: number;
  seekTarget: number;
  expectedFinalPosition: number;
  duration: number;
}

export const SEEK_TEST_SCENARIOS: SeekTestScenario[] = [
  {
    name: 'seek forward within bounds',
    initialPosition: 100,
    seekTarget: 500,
    expectedFinalPosition: 500,
    duration: 3600,
  },
  {
    name: 'seek backward within bounds',
    initialPosition: 1000,
    seekTarget: 200,
    expectedFinalPosition: 200,
    duration: 3600,
  },
  {
    name: 'seek to start',
    initialPosition: 500,
    seekTarget: 0,
    expectedFinalPosition: 0,
    duration: 3600,
  },
  {
    name: 'seek past end clamps to duration',
    initialPosition: 100,
    seekTarget: 5000,
    expectedFinalPosition: 3600,
    duration: 3600,
  },
  {
    name: 'seek before start clamps to zero',
    initialPosition: 100,
    seekTarget: -100,
    expectedFinalPosition: 0,
    duration: 3600,
  },
];

// =============================================================================
// Rate Testing Helpers
// =============================================================================

export const PLAYBACK_RATE_TEST_VALUES = [
  { rate: 0.5, label: 'half speed' },
  { rate: 0.75, label: '0.75x' },
  { rate: 1.0, label: 'normal' },
  { rate: 1.25, label: '1.25x' },
  { rate: 1.5, label: '1.5x' },
  { rate: 2.0, label: 'double speed' },
  { rate: 3.0, label: 'max speed' },
];
