/**
 * src/features/player/machines/audioMachine.ts
 *
 * XState state machine for audio playback.
 * Replaces flag-based state management with explicit states and transitions.
 *
 * States:
 * - idle: No audio loaded
 * - loading: Audio file is being loaded
 * - ready: Audio loaded, ready to play
 * - playing: Audio is playing
 * - paused: Audio is paused
 * - buffering: Waiting for data
 * - seeking: Position change in progress
 * - error: Error occurred
 *
 * This machine ensures:
 * - Only valid transitions occur
 * - Position updates blocked during seeking
 * - Clean error recovery
 * - Predictable state changes
 */

import { setup, assign, fromPromise, AnyActorRef } from 'xstate';

// =============================================================================
// Types
// =============================================================================

export interface AudioContext {
  // Current playback state
  position: number;
  duration: number;
  playbackRate: number;

  // Track info
  currentTrackIndex: number;
  trackCount: number;

  // Seek state
  seekPosition: number | null;

  // Book info
  bookId: string | null;
  bookTitle: string | null;

  // Error info
  errorMessage: string | null;
  errorCode: string | null;

  // Buffer info
  bufferedPosition: number;

  // Pause tracking for smart rewind
  lastPauseTime: number | null;
}

export type AudioEvent =
  | { type: 'LOAD'; bookId: string; bookTitle: string; trackCount: number }
  | { type: 'LOADED'; duration: number; position: number }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'STOP' }
  | { type: 'SEEK'; position: number }
  | { type: 'SEEK_COMPLETE'; position: number }
  | { type: 'POSITION_UPDATE'; position: number }
  | { type: 'RATE_CHANGE'; rate: number }
  | { type: 'TRACK_CHANGE'; trackIndex: number }
  | { type: 'BUFFER_START' }
  | { type: 'BUFFER_END' }
  | { type: 'ERROR'; message: string; code?: string }
  | { type: 'RETRY' }
  | { type: 'RESET' };

// =============================================================================
// Initial Context
// =============================================================================

const initialContext: AudioContext = {
  position: 0,
  duration: 0,
  playbackRate: 1.0,
  currentTrackIndex: 0,
  trackCount: 0,
  seekPosition: null,
  bookId: null,
  bookTitle: null,
  errorMessage: null,
  errorCode: null,
  bufferedPosition: 0,
  lastPauseTime: null,
};

// =============================================================================
// State Machine
// =============================================================================

export const audioMachine = setup({
  types: {
    context: {} as AudioContext,
    events: {} as AudioEvent,
  },
  actions: {
    setLoadingInfo: assign({
      bookId: (_, params: { bookId: string; bookTitle: string; trackCount: number }) => params.bookId,
      bookTitle: (_, params: { bookId: string; bookTitle: string; trackCount: number }) => params.bookTitle,
      trackCount: (_, params: { bookId: string; bookTitle: string; trackCount: number }) => params.trackCount,
    }),
    setLoadedInfo: assign({
      duration: (_, params: { duration: number; position: number }) => params.duration,
      position: (_, params: { duration: number; position: number }) => params.position,
    }),
    setPosition: assign({
      position: (_, params: { position: number }) => params.position,
    }),
    setSeekPosition: assign({
      seekPosition: (_, params: { position: number }) => params.position,
    }),
    clearSeekPosition: assign({
      seekPosition: () => null,
    }),
    setPlaybackRate: assign({
      playbackRate: (_, params: { rate: number }) => params.rate,
    }),
    setTrackIndex: assign({
      currentTrackIndex: (_, params: { trackIndex: number }) => params.trackIndex,
    }),
    setError: assign({
      errorMessage: (_, params: { message: string; code?: string }) => params.message,
      errorCode: (_, params: { message: string; code?: string }) => params.code ?? null,
    }),
    clearError: assign({
      errorMessage: () => null,
      errorCode: () => null,
    }),
    setPauseTime: assign({
      lastPauseTime: () => Date.now(),
    }),
    clearPauseTime: assign({
      lastPauseTime: () => null,
    }),
    resetContext: assign(() => initialContext),
  },
  guards: {
    isValidSeekPosition: ({ context }, params: { position: number }) =>
      params.position >= 0 && params.position <= context.duration,
    hasBookLoaded: ({ context }) => context.bookId !== null,
  },
}).createMachine({
  id: 'audio',
  initial: 'idle',
  context: initialContext,
  states: {
    idle: {
      on: {
        LOAD: {
          target: 'loading',
          actions: [
            {
              type: 'setLoadingInfo',
              params: ({ event }) => ({
                bookId: event.bookId,
                bookTitle: event.bookTitle,
                trackCount: event.trackCount,
              }),
            },
          ],
        },
      },
    },

    loading: {
      on: {
        LOADED: {
          target: 'ready',
          actions: [
            {
              type: 'setLoadedInfo',
              params: ({ event }) => ({
                duration: event.duration,
                position: event.position,
              }),
            },
          ],
        },
        ERROR: {
          target: 'error',
          actions: [
            {
              type: 'setError',
              params: ({ event }) => ({
                message: event.message,
                code: event.code,
              }),
            },
          ],
        },
        RESET: {
          target: 'idle',
          actions: 'resetContext',
        },
      },
    },

    ready: {
      on: {
        PLAY: {
          target: 'playing',
          actions: 'clearPauseTime',
        },
        SEEK: {
          target: 'seeking',
          actions: [
            {
              type: 'setSeekPosition',
              params: ({ event }) => ({ position: event.position }),
            },
          ],
        },
        RESET: {
          target: 'idle',
          actions: 'resetContext',
        },
      },
    },

    playing: {
      on: {
        PAUSE: {
          target: 'paused',
          actions: 'setPauseTime',
        },
        STOP: {
          target: 'ready',
        },
        SEEK: {
          target: 'seeking',
          actions: [
            {
              type: 'setSeekPosition',
              params: ({ event }) => ({ position: event.position }),
            },
          ],
        },
        POSITION_UPDATE: {
          actions: [
            {
              type: 'setPosition',
              params: ({ event }) => ({ position: event.position }),
            },
          ],
        },
        RATE_CHANGE: {
          actions: [
            {
              type: 'setPlaybackRate',
              params: ({ event }) => ({ rate: event.rate }),
            },
          ],
        },
        TRACK_CHANGE: {
          actions: [
            {
              type: 'setTrackIndex',
              params: ({ event }) => ({ trackIndex: event.trackIndex }),
            },
          ],
        },
        BUFFER_START: {
          target: 'buffering',
        },
        ERROR: {
          target: 'error',
          actions: [
            {
              type: 'setError',
              params: ({ event }) => ({
                message: event.message,
                code: event.code,
              }),
            },
          ],
        },
        RESET: {
          target: 'idle',
          actions: 'resetContext',
        },
      },
    },

    paused: {
      on: {
        PLAY: {
          target: 'playing',
          actions: 'clearPauseTime',
        },
        STOP: {
          target: 'ready',
        },
        SEEK: {
          target: 'seeking',
          actions: [
            {
              type: 'setSeekPosition',
              params: ({ event }) => ({ position: event.position }),
            },
          ],
        },
        POSITION_UPDATE: {
          // Allow position updates while paused (for sync corrections)
          actions: [
            {
              type: 'setPosition',
              params: ({ event }) => ({ position: event.position }),
            },
          ],
        },
        RATE_CHANGE: {
          actions: [
            {
              type: 'setPlaybackRate',
              params: ({ event }) => ({ rate: event.rate }),
            },
          ],
        },
        ERROR: {
          target: 'error',
          actions: [
            {
              type: 'setError',
              params: ({ event }) => ({
                message: event.message,
                code: event.code,
              }),
            },
          ],
        },
        RESET: {
          target: 'idle',
          actions: 'resetContext',
        },
      },
    },

    buffering: {
      on: {
        BUFFER_END: {
          target: 'playing',
        },
        PAUSE: {
          target: 'paused',
          actions: 'setPauseTime',
        },
        SEEK: {
          target: 'seeking',
          actions: [
            {
              type: 'setSeekPosition',
              params: ({ event }) => ({ position: event.position }),
            },
          ],
        },
        ERROR: {
          target: 'error',
          actions: [
            {
              type: 'setError',
              params: ({ event }) => ({
                message: event.message,
                code: event.code,
              }),
            },
          ],
        },
        RESET: {
          target: 'idle',
          actions: 'resetContext',
        },
      },
    },

    seeking: {
      // CRITICAL: No POSITION_UPDATE events handled here
      // This prevents UI jitter during seek operations
      on: {
        SEEK_COMPLETE: {
          target: 'paused',
          actions: [
            {
              type: 'setPosition',
              params: ({ event }) => ({ position: event.position }),
            },
            'clearSeekPosition',
          ],
        },
        SEEK: {
          // Allow chained seeks (e.g., scrubbing)
          actions: [
            {
              type: 'setSeekPosition',
              params: ({ event }) => ({ position: event.position }),
            },
          ],
        },
        ERROR: {
          target: 'error',
          actions: [
            {
              type: 'setError',
              params: ({ event }) => ({
                message: event.message,
                code: event.code,
              }),
            },
            'clearSeekPosition',
          ],
        },
        RESET: {
          target: 'idle',
          actions: 'resetContext',
        },
      },
    },

    error: {
      on: {
        RETRY: {
          target: 'loading',
          actions: 'clearError',
        },
        RESET: {
          target: 'idle',
          actions: 'resetContext',
        },
      },
    },
  },
});

// =============================================================================
// Type Exports
// =============================================================================

export type AudioMachine = typeof audioMachine;
export type AudioState = ReturnType<typeof audioMachine.transition>['value'];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if the current state allows position updates.
 * Position updates are blocked during seeking to prevent UI jitter.
 */
export function canUpdatePosition(state: AudioState): boolean {
  return state !== 'seeking' && state !== 'loading' && state !== 'idle';
}

/**
 * Check if playback controls are available.
 */
export function canControl(state: AudioState): boolean {
  return (
    state === 'ready' ||
    state === 'playing' ||
    state === 'paused' ||
    state === 'buffering'
  );
}

/**
 * Check if the audio is in a playable state.
 */
export function isPlayable(state: AudioState): boolean {
  return state === 'ready' || state === 'paused';
}

/**
 * Check if seeking is in progress.
 */
export function isSeeking(state: AudioState): boolean {
  return state === 'seeking';
}

/**
 * Check if there's an error.
 */
export function hasError(state: AudioState): boolean {
  return state === 'error';
}

/**
 * Get human-readable state description.
 */
export function getStateDescription(state: AudioState): string {
  switch (state) {
    case 'idle':
      return 'No audio loaded';
    case 'loading':
      return 'Loading audio...';
    case 'ready':
      return 'Ready to play';
    case 'playing':
      return 'Playing';
    case 'paused':
      return 'Paused';
    case 'buffering':
      return 'Buffering...';
    case 'seeking':
      return 'Seeking...';
    case 'error':
      return 'Error occurred';
    default:
      return 'Unknown state';
  }
}
