/**
 * src/features/wishlist/index.ts
 *
 * Public exports for the wishlist feature.
 */

// Screens
export { WishlistScreen } from './screens';

// Components
export { WishlistItemRow, ManualAddSheet } from './components';

// Store and hooks
export {
  useWishlistStore,
  useIsOnWishlist,
  useWishlistItemByLibraryId,
  useWishlistCount,
  useFollowedAuthorsCount,
  useTrackedSeriesCount,
  useIsAuthorFollowed,
  useIsSeriesTracked,
} from './stores';

// Types
export type {
  WishlistItem,
  WishlistPriority,
  WishlistSource,
  WishlistStatus,
  WishlistSortOption,
  WishlistFilters,
  FollowedAuthor,
  TrackedSeries,
  ExternalBookResult,
  WishlistNotification,
} from './types';
