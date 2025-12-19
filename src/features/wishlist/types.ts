/**
 * src/features/wishlist/types.ts
 *
 * Type definitions for the Wishlist feature.
 * Supports manual entries, server book references, author following,
 * and series tracking.
 */

/**
 * Priority level for wishlist items
 * - must-read: Highest priority, shows at top
 * - want-to-read: Normal priority
 * - maybe: Lower priority, might read someday
 */
export type WishlistPriority = 'must-read' | 'want-to-read' | 'maybe';

/**
 * Source of how the book was added to wishlist
 */
export type WishlistSource =
  | 'manual'           // User typed it in manually
  | 'server-search'    // Found via server library search
  | 'external-search'  // Found via external API (Audnexus, etc.)
  | 'author-follow'    // Added because user follows the author
  | 'series-track';    // Added because user tracks the series

/**
 * Status of a wishlist item
 */
export type WishlistStatus =
  | 'wishlist'         // On the wishlist, not yet available
  | 'available'        // Now available in user's library
  | 'downloaded'       // Downloaded and ready to listen
  | 'in-progress'      // Currently listening
  | 'completed';       // Finished listening

/**
 * Core wishlist item - represents a book the user wants to read
 */
export interface WishlistItem {
  /** Unique identifier for this wishlist entry */
  id: string;

  /** Server library item ID (if book exists in library) */
  libraryItemId?: string;

  /** Manual entry data (if book doesn't exist in library) */
  manual?: {
    title: string;
    author: string;
    narrator?: string;
    series?: string;
    seriesSequence?: string;
    coverUrl?: string;
    isbn?: string;
    asin?: string;
    description?: string;
    estimatedDuration?: number; // in seconds
    genres?: string[];
  };

  /** When the item was added to wishlist */
  addedAt: string; // ISO date string

  /** Priority level */
  priority: WishlistPriority;

  /** User's personal notes about this book */
  notes?: string;

  /** How this item was added */
  source: WishlistSource;

  /** Current status */
  status: WishlistStatus;

  /** Tags for organization */
  tags?: string[];

  /** Expected release date (for pre-release books) */
  expectedReleaseDate?: string;

  /** Notification preferences */
  notifyOnAvailable?: boolean;

  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * Followed author - user wants to be notified of new releases
 */
export interface FollowedAuthor {
  /** Unique identifier */
  id: string;

  /** Author's name (for display even if not in library) */
  name: string;

  /** Server author ID (if author exists in library) */
  libraryAuthorId?: string;

  /** External identifiers */
  external?: {
    audnexusId?: string;
    goodreadsId?: string;
  };

  /** When the user started following */
  followedAt: string;

  /** Author's image URL */
  imageUrl?: string;

  /** Count of books by this author in user's library */
  libraryBookCount?: number;

  /** Count of books by this author on wishlist */
  wishlistBookCount?: number;
}

/**
 * Tracked series - user wants to be notified of new entries
 */
export interface TrackedSeries {
  /** Unique identifier */
  id: string;

  /** Series name */
  name: string;

  /** Server series ID (if series exists in library) */
  librarySeriesId?: string;

  /** External identifiers */
  external?: {
    audnexusId?: string;
    goodreadsSeriesId?: string;
  };

  /** When the user started tracking */
  trackedAt: string;

  /** Number of books in the series (known) */
  totalBooks?: number;

  /** Number of books user has in library */
  ownedBooks?: number;

  /** Number of books on wishlist */
  wishlistBooks?: number;

  /** Series cover/image URL */
  imageUrl?: string;
}

/**
 * Sort options for wishlist view
 */
export type WishlistSortOption =
  | 'date-added'
  | 'priority'
  | 'title'
  | 'author'
  | 'release-date';

/**
 * Filter options for wishlist view
 */
export interface WishlistFilters {
  priority?: WishlistPriority[];
  status?: WishlistStatus[];
  source?: WishlistSource[];
  tags?: string[];
  hasNotes?: boolean;
}

/**
 * External book search result (from Audnexus, Open Library, etc.)
 */
export interface ExternalBookResult {
  /** External source */
  source: 'audnexus' | 'openlibrary' | 'googlebooks';

  /** External ID from the source */
  externalId: string;

  /** Book title */
  title: string;

  /** Author name */
  author: string;

  /** Narrator (if audiobook) */
  narrator?: string;

  /** Cover image URL */
  coverUrl?: string;

  /** ISBN */
  isbn?: string;

  /** ASIN (Amazon) */
  asin?: string;

  /** Description/summary */
  description?: string;

  /** Duration in seconds */
  duration?: number;

  /** Publication/release date */
  releaseDate?: string;

  /** Series name */
  series?: string;

  /** Position in series */
  seriesSequence?: string;

  /** Genres/categories */
  genres?: string[];
}

/**
 * Notification for wishlist item availability
 */
export interface WishlistNotification {
  id: string;
  wishlistItemId: string;
  type: 'available' | 'new-release' | 'price-drop';
  title: string;
  message: string;
  createdAt: string;
  readAt?: string;
}
