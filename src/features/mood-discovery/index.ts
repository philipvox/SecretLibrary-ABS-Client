/**
 * src/features/mood-discovery/index.ts
 *
 * Mood-Based Discovery feature exports.
 * Provides ephemeral "What sounds good right now?" recommendation tuning.
 */

// Types
export * from './types';

// Store
export {
  useMoodSessionStore,
  useHasActiveSession,
  useActiveSession,
  useMoodDraft,
  useQuizActions,
  useMoodDraftActions,
  useSessionInfo,
  formatTimeRemaining,
  getTimeRemainingFromExpiry,
  isSessionValid,
  getSessionDisplayLabel,
} from './stores/moodSessionStore';

// Components
export { QuickTuneBar } from './components/QuickTuneBar';
export { MoodBookCard } from './components/MoodBookCard';
export { MoodDiscoveryCard } from './components/MoodDiscoveryCard';

// Hooks
export { useMoodFilteredBooks, useAllFilteredBooks } from './hooks/useMoodFilteredBooks';
export {
  useMoodRecommendations,
  useBookMoodScore,
  useMoodRecommendationsByQuality,
} from './hooks/useMoodRecommendations';

// Screens
export { MoodDiscoveryScreen } from './screens/MoodDiscoveryScreen';
export { MoodResultsScreen } from './screens/MoodResultsScreen';
