/**
 * src/features/completion/index.ts
 *
 * Completion feature - manual book completion tracking
 */

// Store & hooks
export {
  useCompletionStore,
  useIsComplete,
  useMarkComplete,
  useMarkIncomplete,
  useToggleComplete,
} from './stores/completionStore';

// Components
export {
  CompleteBadge,
  CompleteBadgeOverlay,
  CompleteBanner,
} from './components';
