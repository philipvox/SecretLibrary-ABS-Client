/**
 * src/core/api/index.ts
 *
 * API module public exports
 */

// Core client
export { apiClient } from './apiClient';
export type { ApiClient } from './apiClient';

// Custom error classes
export {
  ApiError,
  NetworkError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  ServerError,
  TimeoutError,
  CancelledError,
  OfflineError,
  isApiError,
  isNetworkError,
  isAuthError,
  isTimeoutError,
  isOfflineError,
  ErrorCodes,
} from './errors';
export type { ErrorCode } from './errors';

// Middleware system
export {
  middlewareManager,
  loggingMiddleware,
  performanceTracker,
  offlineMiddleware,
  createAuthRefreshMiddleware,
} from './middleware';
export type {
  RequestContext,
  ResponseContext,
  ErrorContext,
  RequestMiddleware,
  ResponseMiddleware,
  ErrorMiddleware,
} from './middleware';

// Network optimization utilities
export {
  networkOptimizer,
  withRetry,
  ResponseCache,
  RequestDeduplicator,
  RequestQueue,
} from './networkOptimizer';
export type { RetryConfig, Priority } from './networkOptimizer';

// Domain-specific APIs
export {
  authApi,
  userApi,
  librariesApi,
  itemsApi,
  collectionsApi,
  seriesApi,
  authorsApi,
  playlistsApi,
} from './endpoints';

// Offline-aware API functions
export {
  updateProgressOffline,
  toggleFavoriteOffline,
  addToCollectionOffline,
  removeFromCollectionOffline,
  getProgressOffline,
  requireOnline,
  onlineOrQueue,
} from './offlineApi';

// Playback session API
export {
  startPlaybackSession,
  syncSessionProgress,
  closePlaybackSession,
  buildStreamUrl,
  getMediaProgress,
  updateMediaProgress,
  hideFromContinueListening,
} from './playbackApi';
export type {
  PlaybackSession,
  AudioTrack,
  PlaybackChapter,
} from './playbackApi';