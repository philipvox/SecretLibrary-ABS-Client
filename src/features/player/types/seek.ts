/**
 * src/features/player/types/seek.ts
 *
 * Type definitions for the robust seek/chapter navigation system.
 */

import { Chapter } from '../stores/playerStore';

/**
 * Seek operation states for the state machine
 */
export type SeekOperationState =
  | 'idle'
  | 'seeking'
  | 'chapter_transition'
  | 'confirming';

/**
 * Direction of seek operation
 */
export type SeekDirection = 'forward' | 'backward';

/**
 * Information about a chapter boundary crossing
 */
export interface ChapterCrossing {
  fromChapter: Chapter;
  fromChapterIndex: number;
  toChapter: Chapter;
  toChapterIndex: number;
  fromPosition: number;
  targetPosition: number;
  /** Position within the destination chapter */
  positionInChapter: number;
}

/**
 * Lock state for preventing concurrent seek operations
 */
export interface SeekLock {
  isLocked: boolean;
  operation: 'seek' | 'chapter-change' | 'continuous' | null;
  startTime: number;
  targetPosition: number;
  targetChapter: number | null;
  direction: SeekDirection | null;
}

/**
 * State exposed by the seek control hook
 */
export interface SeekControlState {
  /** Whether any seek operation is in progress */
  isSeeking: boolean;
  /** Whether a chapter transition is in progress */
  isChangingChapter: boolean;
  /** Direction of current seek operation */
  seekDirection: SeekDirection | null;
  /** How far we're seeking (for UI feedback) */
  seekMagnitude: number;
  /** Current seek position during operation */
  seekPosition: number;
  /** Delta from start position */
  seekDelta: number;
}

/**
 * Actions exposed by the seek control hook
 */
export interface SeekControlActions {
  /** Seek by a relative amount of seconds */
  seekRelative: (seconds: number) => Promise<void>;
  /** Seek to an absolute position */
  seekAbsolute: (position: number) => Promise<void>;
  /** Seek to a specific chapter */
  seekToChapter: (chapterIndex: number) => Promise<void>;
  /** Cancel any in-progress seek */
  cancelSeek: () => void;
  /** Start continuous seeking (hold button) */
  startContinuousSeek: (direction: SeekDirection) => Promise<void>;
  /** Stop continuous seeking */
  stopContinuousSeek: () => Promise<void>;
  /** Go to next chapter */
  nextChapter: () => Promise<void>;
  /** Go to previous chapter */
  prevChapter: () => Promise<void>;
}

/**
 * Combined return type for useSeekControl hook
 */
export type UseSeekControlReturn = SeekControlState & SeekControlActions;

/**
 * Animation suspension state
 */
export interface AnimationSuspension {
  isSuspended: boolean;
  suspendedAt: number;
  reason: 'seek' | 'chapter-change' | null;
}

/**
 * Actions exposed by the animation control hook
 */
export interface AnimationControlActions {
  /** Suspend all animations */
  suspend: (reason: 'seek' | 'chapter-change') => void;
  /** Resume animations with smooth transition */
  resume: () => void;
  /** Check if animations are suspended */
  isSuspended: () => boolean;
}

/**
 * Return type for useAnimationControl hook
 */
export interface UseAnimationControlReturn {
  isSuspended: boolean;
  suspend: (reason: 'seek' | 'chapter-change') => void;
  resume: () => void;
}
