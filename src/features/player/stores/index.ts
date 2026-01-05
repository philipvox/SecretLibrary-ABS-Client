/**
 * src/features/player/stores/index.ts
 *
 * Player stores facade - centralized exports for all player-related stores.
 * Created as part of Phase 9 refactor to provide clean import paths.
 *
 * Architecture:
 * - playerStore: Core playback state (position, chapters, play/pause)
 * - playerSettingsStore: UI/behavior settings (skip intervals, control mode)
 * - bookmarksStore: Bookmark CRUD operations
 * - sleepTimerStore: Sleep timer with shake-to-extend
 * - speedStore: Playback speed management (per-book memory)
 * - completionStore: Book completion handling
 * - seekingStore: Seeking state and operations (CRITICAL for UI jitter fix)
 * - playerSelectors: Derived state selectors
 */

// =============================================================================
// CORE STORE
// =============================================================================

export {
  usePlayerStore,
  type Chapter,
  type Bookmark,
  type SeekDirection,
} from './playerStore';

// =============================================================================
// SETTINGS STORE
// =============================================================================

export {
  usePlayerSettingsStore,
  type ControlMode,
  type ProgressMode,
  // Selectors
  useControlMode,
  useProgressMode,
  useSkipIntervals,
  usePlayerAppearance,
  useSmartRewindSettings,
} from './playerSettingsStore';

// =============================================================================
// BOOKMARKS STORE
// =============================================================================

export {
  useBookmarksStore,
  type Bookmark as BookmarkRecord,
  // Selectors
  useBookmarks,
  useBookmarkCount,
  useBookmarkById,
  useBookmarksSortedByTime,
} from './bookmarksStore';

// =============================================================================
// SLEEP TIMER STORE
// =============================================================================

export {
  useSleepTimerStore,
  // Selectors
  useSleepTimer,
  useIsSleepTimerActive,
  useShakeToExtendEnabled,
  useIsShakeDetectionActive as useSleepTimerShakeDetectionActive,
  useSleepTimerState as useSleepTimerFullState,
} from './sleepTimerStore';

// =============================================================================
// SPEED STORE
// =============================================================================

export {
  useSpeedStore,
  // Selectors
  usePlaybackRate,
  useGlobalDefaultRate,
  useBookSpeed,
  useHasCustomSpeed,
} from './speedStore';

// =============================================================================
// COMPLETION STORE
// =============================================================================

export {
  useCompletionStore,
  // Selectors
  useShowCompletionPrompt,
  useAutoMarkFinished,
  useIsCompletionSheetVisible,
  useCompletionSheetBook,
  useCompletionState,
} from './completionStore';

// =============================================================================
// SEEKING STORE
// =============================================================================

export {
  useSeekingStore,
  type SeekDirection as SeekDirectionType,
  // Selectors
  useIsSeeking as useSeekingIsSeeking,
  useSeekPosition,
  useSeekStartPosition,
  useSeekDirection as useSeekingDirection,
  useSeekDelta as useSeekingDelta,
  useSeekingState,
} from './seekingStore';

// =============================================================================
// SELECTORS (from playerSelectors.ts)
// =============================================================================

export {
  // Position
  useDisplayPosition,
  useEffectivePosition,
  // Seek (from playerStore state)
  useSeekDelta,
  useIsSeeking,
  useSeekDirection,
  // Chapter
  useCurrentChapterIndex,
  useCurrentChapter,
  useChapterProgress,
  // Progress
  useBookProgress,
  usePercentComplete,
  useTimeRemaining,
  // Book
  useIsViewingDifferentBook,
  useViewingBook,
  usePlayingBook,
  // Sleep timer (from playerStore state)
  useIsShakeDetectionActive,
  useSleepTimerState,
  // Playback
  usePlaybackState,
  usePlayerVisibility,
  useCurrentBookId,
} from './playerSelectors';
