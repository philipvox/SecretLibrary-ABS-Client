// Removed hooks in orphan cleanup (2026-01-21):
// - useAppBootstrap
// - useLibraryPrefetch
// - useOptimisticMutation
// - useSyncStatus

export {
  useDownloads,
  useDownloadStatus,
  useDownloadProgress,
  useIsOfflineAvailable,
} from './useDownloads';

// Unified user book data hooks (single source of truth)
export {
  // Query keys
  userBooksKeys,
  // Single book hooks
  useUserBook,
  useBookProgress,
  useIsFavorite,
  useIsFinished,
  useBookPlaybackSpeed,
  // Collection hooks
  useFavoriteBooks,
  useFinishedBooks,
  useInProgressBooks,
  useUnsyncedBooks,
  // Mutation hooks
  useUpdateProgress,
  useToggleFavorite,
  useMarkFinished,
  useSetPlaybackSpeed,
  useUpdateUserBook,
  useMarkSynced,
  // Combined hooks
  useBookStatus,
  useBookActions,
  useUserBookCounts,
} from './useUserBooks';
