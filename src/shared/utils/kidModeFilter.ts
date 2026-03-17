/**
 * src/shared/utils/kidModeFilter.ts
 *
 * Utility functions for filtering content based on Kid Mode settings.
 * Uses customizable allowed/blocked genres/tags and age category filtering.
 */

import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import {
  getKidModeSettings,
  AgeCategory,
  AGE_CATEGORY_ORDER,
  AGE_CATEGORY_TAGS,
  ContentRating,
  RATING_ORDER,
  RATING_TAGS,
} from '@/shared/stores/kidModeStore';

// Helper to get book metadata safely
function getBookMetadata(item: LibraryItem): BookMetadata | null {
  if (item.mediaType !== 'book' || !item.media?.metadata) return null;
  return item.media.metadata as BookMetadata;
}

// Type guard for book media
function isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  return media !== undefined && 'tags' in media;
}

/**
 * Settings for kid-friendly filtering
 */
interface KidModeFilterSettings {
  allowedGenres: string[];
  allowedTags: string[];
  blockedGenres: string[];
  blockedTags: string[];
  useAgeFiltering: boolean;
  maxAgeCategory: AgeCategory;
  useRatingFiltering: boolean;
  maxRating: ContentRating;
  useAllowedGenresTags: boolean;
}

/**
 * Checks if a string matches any item in a list (case-insensitive, partial match)
 */
function matchesAny(value: string, list: string[]): boolean {
  const lowerValue = value.toLowerCase().trim();
  return list.some(
    (item) => lowerValue === item || lowerValue.includes(item) || item.includes(lowerValue)
  );
}

/**
 * Detects the age category from a tag string.
 * Checks against AGE_CATEGORY_TAGS for matches.
 * @returns The age category or null if no match
 */
export function getAgeCategoryFromTag(tag: string): AgeCategory | null {
  const lower = tag.toLowerCase().trim();

  // Check each category's tags
  for (const category of AGE_CATEGORY_ORDER) {
    const categoryTags = AGE_CATEGORY_TAGS[category];
    for (const catTag of categoryTags) {
      if (lower === catTag || lower.includes(catTag) || catTag.includes(lower)) {
        return category;
      }
    }
  }

  return null;
}

/**
 * Extracts the most restrictive (oldest) age category from an array of tags.
 * @returns The age category or null if no category tags found
 */
export function getAgeCategoryFromTags(tags: string[]): AgeCategory | null {
  let foundCategory: AgeCategory | null = null;
  let foundIndex = -1;

  for (const tag of tags) {
    const category = getAgeCategoryFromTag(tag);
    if (category !== null) {
      const index = AGE_CATEGORY_ORDER.indexOf(category);
      // Take the most restrictive (highest index = older)
      if (index > foundIndex) {
        foundCategory = category;
        foundIndex = index;
      }
    }
  }

  return foundCategory;
}

/**
 * Checks if a book passes the age category filter.
 * @returns Object with pass status and found category
 */
function passesAgeCategoryFilter(
  bookTags: string[],
  useAgeFiltering: boolean,
  maxAgeCategory: AgeCategory
): { passes: boolean; foundCategory: AgeCategory | null } {
  if (!useAgeFiltering) {
    return { passes: true, foundCategory: null };
  }

  const bookCategory = getAgeCategoryFromTags(bookTags);

  // If no category tag found, we can't filter by category - let genre/tag filtering handle it
  if (bookCategory === null) {
    return { passes: true, foundCategory: null };
  }

  // Compare indices - book passes if its category index <= max category index
  const bookIndex = AGE_CATEGORY_ORDER.indexOf(bookCategory);
  const maxIndex = AGE_CATEGORY_ORDER.indexOf(maxAgeCategory);

  return { passes: bookIndex <= maxIndex, foundCategory: bookCategory };
}

/**
 * Detects the content rating from a tag string.
 * Checks against RATING_TAGS for matches.
 * @returns The content rating or null if no match
 */
export function getRatingFromTag(tag: string): ContentRating | null {
  const lower = tag.toLowerCase().trim();

  // Check each rating's tags
  for (const rating of RATING_ORDER) {
    const ratingTags = RATING_TAGS[rating];
    for (const ratingTag of ratingTags) {
      if (lower === ratingTag || lower.includes(ratingTag)) {
        return rating;
      }
    }
  }

  return null;
}

/**
 * Extracts the most restrictive (highest) content rating from an array of tags.
 * @returns The content rating or null if no rating tags found
 */
export function getRatingFromTags(tags: string[]): ContentRating | null {
  let foundRating: ContentRating | null = null;
  let foundIndex = -1;

  for (const tag of tags) {
    const rating = getRatingFromTag(tag);
    if (rating !== null) {
      const index = RATING_ORDER.indexOf(rating);
      // Take the most restrictive (highest index = more mature)
      if (index > foundIndex) {
        foundRating = rating;
        foundIndex = index;
      }
    }
  }

  return foundRating;
}

/**
 * Checks if a book passes the content rating filter.
 * @returns Object with pass status and found rating
 */
function passesRatingFilter(
  bookTags: string[],
  useRatingFiltering: boolean,
  maxRating: ContentRating
): { passes: boolean; foundRating: ContentRating | null } {
  if (!useRatingFiltering) {
    return { passes: true, foundRating: null };
  }

  const bookRating = getRatingFromTags(bookTags);

  // If no rating tag found, we can't filter by rating - let genre/tag filtering handle it
  if (bookRating === null) {
    return { passes: true, foundRating: null };
  }

  // Compare indices - book passes if its rating index <= max rating index
  const bookIndex = RATING_ORDER.indexOf(bookRating);
  const maxIndex = RATING_ORDER.indexOf(maxRating);

  return { passes: bookIndex <= maxIndex, foundRating: bookRating };
}

/**
 * Checks if a book is kid-friendly based on customizable settings:
 * 1. metadata.explicit !== true (not explicit)
 * 2. Does NOT have any blocked genres or tags
 * 3. Passes age category filter (if tags present and filtering enabled)
 * 4. Passes content rating filter (if tags present and filtering enabled)
 * 5. Has at least one allowed genre OR tag (if no age/rating tag found and allowed filtering enabled)
 *
 * @param item - LibraryItem to check
 * @param settings - Optional settings override (uses store if not provided)
 * @returns true if the book is kid-friendly
 */
export function isKidFriendly(item: LibraryItem, settings?: KidModeFilterSettings): boolean {
  const {
    allowedGenres,
    allowedTags,
    blockedGenres,
    blockedTags,
    useAgeFiltering,
    maxAgeCategory,
    useRatingFiltering,
    maxRating,
    useAllowedGenresTags,
  } = settings || getKidModeSettings();

  const metadata = getBookMetadata(item);

  // 1. Check explicit flag - block if true
  if (metadata?.explicit === true) {
    return false;
  }

  // Get genres and tags from the book
  const bookGenres: string[] = (metadata?.genres || []).map((g: string) =>
    g.toLowerCase().trim()
  );
  const bookTags: string[] = isBookMedia(item.media)
    ? (item.media.tags || []).map((t: string) => t.toLowerCase().trim())
    : [];

  // 2. Check for blocked genres - if ANY match, block the book
  for (const genre of bookGenres) {
    if (matchesAny(genre, blockedGenres)) {
      return false;
    }
  }

  // 3. Check for blocked tags - if ANY match, block the book
  for (const tag of bookTags) {
    if (matchesAny(tag, blockedTags)) {
      return false;
    }
  }

  // 4. Check age category filter
  const { passes: categoryPasses, foundCategory } = passesAgeCategoryFilter(
    bookTags,
    useAgeFiltering,
    maxAgeCategory
  );
  if (!categoryPasses) {
    return false;
  }

  // 5. Check content rating filter
  const { passes: ratingPasses, foundRating } = passesRatingFilter(
    bookTags,
    useRatingFiltering,
    maxRating
  );
  if (!ratingPasses) {
    return false;
  }

  // 6. If age category or rating was found and passes, the book is kid-friendly
  if (foundCategory !== null || foundRating !== null) {
    return true;
  }

  // 7. If allowed genres/tags filtering is disabled, book passes (only blocked items checked)
  if (!useAllowedGenresTags) {
    return true;
  }

  // 8. Otherwise, must have at least one allowed genre OR tag
  const hasAllowedGenre = bookGenres.some((genre) => matchesAny(genre, allowedGenres));
  const hasAllowedTag = bookTags.some((tag) => matchesAny(tag, allowedTags));

  return hasAllowedGenre || hasAllowedTag;
}

/**
 * Filters an array of LibraryItems based on Kid Mode.
 * If Kid Mode is disabled, returns all items unchanged.
 * If Kid Mode is enabled, returns only kid-friendly items.
 *
 * @param items - Array of LibraryItems to filter
 * @param kidModeEnabled - Whether kid mode is currently enabled
 * @param settings - Optional settings override
 * @returns Filtered array
 */
export function filterForKidMode<T extends LibraryItem>(
  items: T[],
  kidModeEnabled: boolean,
  settings?: KidModeFilterSettings
): T[] {
  if (!kidModeEnabled) {
    return items;
  }

  const filterSettings = settings || getKidModeSettings();
  return items.filter((item) => isKidFriendly(item, filterSettings));
}

/**
 * Applies Kid Mode filter using the global store state.
 * Useful for non-React contexts where you can't use hooks.
 *
 * @param items - Array of LibraryItems to filter
 * @returns Filtered array based on current Kid Mode state
 */
export function applyKidModeFilter<T extends LibraryItem>(items: T[]): T[] {
  const settings = getKidModeSettings();
  return filterForKidMode(items, settings.enabled, settings);
}
