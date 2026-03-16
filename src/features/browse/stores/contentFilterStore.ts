/**
 * src/features/browse/stores/contentFilterStore.ts
 *
 * Store for content filtering by audience (All, Kids, Adults).
 * Uses actual age-related tags and genres from the library.
 * Supports multi-select for age recommendations and age ratings.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LibraryItem, BookMetadata } from '@/core/types';

// =============================================================================
// Types
// =============================================================================

export type AudienceFilter = 'all' | 'kids' | 'adults';

// Age recommendation based on age-rec-* tags
export type AgeRecommendation = '4' | '6' | '8' | '10' | '12' | '14' | '16';

// Age rating categories
export type AgeRating = 'childrens' | 'teens' | 'young-adult';

// Length range for filtering (in hours)
export interface LengthRange {
  min: number;
  max: number;
}

export interface ContentFilterState {
  // Main audience toggle
  audience: AudienceFilter;

  // Selected age recommendations (multi-select)
  selectedAges: AgeRecommendation[];

  // Selected age ratings (multi-select)
  selectedRatings: AgeRating[];

  // Selected tags for filtering (works across all audience modes)
  selectedTags: string[];

  // Selected genres for filtering
  selectedGenres: string[];

  // Length range filter (in hours)
  lengthRange: LengthRange | null;

  // Actions
  setAudience: (audience: AudienceFilter) => void;
  toggleAge: (age: AgeRecommendation) => void;
  toggleRating: (rating: AgeRating) => void;
  toggleTag: (tag: string) => void;
  toggleGenre: (genre: string) => void;
  setSelectedAges: (ages: AgeRecommendation[]) => void;
  setSelectedRatings: (ratings: AgeRating[]) => void;
  setSelectedTags: (tags: string[]) => void;
  setSelectedGenres: (genres: string[]) => void;
  setLengthRange: (range: LengthRange | null) => void;
  clearTags: () => void;
  reset: () => void;
  resetFilters: () => void;
}

// =============================================================================
// Constants - Actual tags/genres from library
// =============================================================================

// Age Rating Tags (age-*)
export const AGE_RATING_TAGS = {
  CHILDRENS: 'age-childrens',
  TEENS: 'age-teens',
  YOUNG_ADULT: 'age-young-adult',
  ADULT: 'age-adult',
} as const;

// Age Recommendation Tags (age-rec-*)
export const AGE_REC_TAGS = {
  ALL: 'age-rec-all',
  '4': 'age-rec-4',
  '6': 'age-rec-6',
  '8': 'age-rec-8',
  '10': 'age-rec-10',
  '12': 'age-rec-12',
  '14': 'age-rec-14',
  '16': 'age-rec-16',
  '18': 'age-rec-18',
} as const;

// Age-Related Genres
const _KIDS_GENRES = [
  "children's 0-2",
  "children's 3-5",
  "children's 6-8",
  "children's 9-12",
  'middle grade',
];

const TEEN_GENRES = [
  'teen 13-17',
  'young adult',
];

const ADULT_GENRES = [
  'new adult',
  'adult',
];

// Default ages for Kids mode (10 and under)
const DEFAULT_KIDS_AGES: AgeRecommendation[] = ['4', '6', '8', '10'];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get book metadata safely
 */
function getBookMetadata(item: LibraryItem): BookMetadata | null {
  if (item.mediaType !== 'book') return null;
  return (item.media as any)?.metadata || null;
}

/**
 * Get book tags safely (lowercase)
 */
function getBookTags(item: LibraryItem): string[] {
  if (item.mediaType !== 'book') return [];
  const tags = (item.media as any)?.tags || [];
  return tags.map((t: string) => t.toLowerCase());
}

/**
 * Get book genres safely (lowercase)
 */
function getBookGenres(item: LibraryItem): string[] {
  const metadata = getBookMetadata(item);
  if (!metadata?.genres) return [];
  return metadata.genres.map((g) => g.toLowerCase());
}

/**
 * Check if book has a specific age rating tag
 */
function hasAgeRatingTag(item: LibraryItem, tag: string): boolean {
  const tags = getBookTags(item);
  return tags.includes(tag.toLowerCase());
}

/**
 * Get the age recommendation number from tags (e.g., age-rec-8 -> 8)
 */
function getAgeRecommendation(item: LibraryItem): number | null {
  const tags = getBookTags(item);

  // Check for age-rec-all first
  if (tags.includes('age-rec-all')) return 0;

  // Check for specific age recommendations
  for (const tag of tags) {
    const match = tag.match(/^age-rec-(\d+)$/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

/**
 * Check if book is kids content based on tags:
 * - for-kids tag
 * - age-childrens or age-teens tag
 * - age-rec-* <= 12
 * - rated-g or rated-pg
 */
export function isKidsContent(item: LibraryItem): boolean {
  const tags = getBookTags(item);

  // Explicit exclusion takes priority
  if (tags.includes('not-for-kids')) return false;
  if (tags.includes('age-adult')) return false;

  // Explicit for-kids tag
  if (tags.includes('for-kids')) return true;

  // Age rating tags
  if (tags.includes('age-childrens') || tags.includes('age-teens')) return true;

  // Age recommendation <= 12
  for (const tag of tags) {
    const match = tag.match(/^age-rec-(\d+)$/);
    if (match) {
      const age = parseInt(match[1], 10);
      if (age <= 12) return true;
    }
    if (tag === 'age-rec-all') return true;
  }

  // Content ratings (only if no age-rec tag present that would contradict)
  if (tags.includes('rated-g') || tags.includes('rated-pg')) return true;

  return false;
}

/**
 * Check if book is adult content based on tags:
 * - not-for-kids tag
 * - age-adult tag
 * - age-rec-* >= 16
 * - rated-r or rated-pg13
 * - explicit flag
 */
export function isAdultOnlyContent(item: LibraryItem): boolean {
  const tags = getBookTags(item);

  // Explicit exclusion takes priority
  if (tags.includes('for-kids')) return false;
  if (tags.includes('age-childrens')) return false;

  // Explicit not-for-kids tag
  if (tags.includes('not-for-kids')) return true;

  // Age rating tags
  if (tags.includes('age-adult')) return true;

  // Age recommendation >= 16
  for (const tag of tags) {
    const match = tag.match(/^age-rec-(\d+)$/);
    if (match) {
      const age = parseInt(match[1], 10);
      if (age >= 16) return true;
    }
  }

  // Content ratings
  if (tags.includes('rated-r') || tags.includes('rated-pg13')) return true;

  // Explicit flag
  const metadata = getBookMetadata(item);
  if (metadata?.explicit) return true;

  return false;
}

/**
 * Check if book is teen/YA content based on tags and genres
 */
export function isTeenContent(item: LibraryItem): boolean {
  // Check age rating tags
  if (hasAgeRatingTag(item, AGE_RATING_TAGS.TEENS)) return true;
  if (hasAgeRatingTag(item, AGE_RATING_TAGS.YOUNG_ADULT)) return true;

  // Check genres
  const genres = getBookGenres(item);
  return TEEN_GENRES.some((g) => genres.includes(g));
}

/**
 * Check if book is adult content based on tags and genres
 */
export function isAdultContent(item: LibraryItem): boolean {
  // Check age rating tags
  if (hasAgeRatingTag(item, AGE_RATING_TAGS.ADULT)) return true;

  // Check explicit flag
  const metadata = getBookMetadata(item);
  if (metadata?.explicit) return true;

  // Check genres
  const genres = getBookGenres(item);
  return ADULT_GENRES.some((g) => genres.includes(g));
}

/**
 * Check if book matches selected age recommendations
 */
export function matchesSelectedAges(
  item: LibraryItem,
  selectedAges: AgeRecommendation[]
): boolean {
  if (selectedAges.length === 0) return true;

  const ageRec = getAgeRecommendation(item);

  // age-rec-all means all ages - always matches
  if (ageRec === 0) return true;

  // If book has an age recommendation, check if it's in selected ages
  if (ageRec !== null) {
    return selectedAges.some((age) => parseInt(age, 10) >= ageRec);
  }

  // No age recommendation - exclude from age-filtered results
  return false;
}

/**
 * Check if book matches selected age ratings
 */
export function matchesSelectedRatings(
  item: LibraryItem,
  selectedRatings: AgeRating[]
): boolean {
  if (selectedRatings.length === 0) return true;

  for (const rating of selectedRatings) {
    switch (rating) {
      case 'childrens':
        if (isKidsContent(item)) return true;
        break;
      case 'teens':
        if (hasAgeRatingTag(item, AGE_RATING_TAGS.TEENS)) return true;
        break;
      case 'young-adult':
        if (hasAgeRatingTag(item, AGE_RATING_TAGS.YOUNG_ADULT) || isTeenContent(item)) return true;
        break;
    }
  }

  return false;
}

/**
 * Get book duration in hours
 */
function getBookDurationHours(item: LibraryItem): number {
  if (item.mediaType !== 'book') return 0;
  const durationSeconds = (item.media as any)?.duration || 0;
  return durationSeconds / 3600; // Convert seconds to hours
}

/**
 * Check if book matches the length range
 */
export function matchesLengthRange(
  item: LibraryItem,
  lengthRange: LengthRange | null
): boolean {
  if (!lengthRange) return true;

  const durationHours = getBookDurationHours(item);
  if (durationHours === 0) return true; // Include books with unknown duration

  return durationHours >= lengthRange.min && durationHours <= lengthRange.max;
}

/**
 * Check if book has any of the selected tags
 */
export function matchesSelectedTags(
  item: LibraryItem,
  selectedTags: string[]
): boolean {
  if (selectedTags.length === 0) return true;

  const bookTags = getBookTags(item);
  // Book must have ALL selected tags (AND logic for stricter filtering)
  // Or use ANY for broader results - using ANY for better UX
  return selectedTags.some((tag) => bookTags.includes(tag.toLowerCase()));
}

/**
 * Check if book has any of the selected genres (OR logic)
 */
export function matchesSelectedGenres(
  item: LibraryItem,
  selectedGenres: string[]
): boolean {
  if (selectedGenres.length === 0) return true;

  const bookGenres = getBookGenres(item);
  return selectedGenres.some((genre) => bookGenres.includes(genre.toLowerCase()));
}

/**
 * Filter library items based on content filter settings
 */
export function filterByAudience(
  items: LibraryItem[],
  audience: AudienceFilter,
  selectedAges: AgeRecommendation[] = [],
  selectedRatings: AgeRating[] = [],
  selectedTags: string[] = [],
  lengthRange: LengthRange | null = null,
  selectedGenres: string[] = []
): LibraryItem[] {
  if (audience === 'all' && selectedAges.length === 0 && selectedRatings.length === 0 && selectedTags.length === 0 && !lengthRange && selectedGenres.length === 0) {
    return items;
  }

  return items.filter((item) => {
    // Skip non-book items
    if (item.mediaType !== 'book') return true;

    // Apply tag filter first (works for all audience modes)
    if (selectedTags.length > 0 && !matchesSelectedTags(item, selectedTags)) {
      return false;
    }

    // Apply genre filter
    if (selectedGenres.length > 0 && !matchesSelectedGenres(item, selectedGenres)) {
      return false;
    }

    // Apply length range filter
    if (lengthRange && !matchesLengthRange(item, lengthRange)) {
      return false;
    }

    if (audience === 'kids') {
      return isKidsContent(item);
    }

    if (audience === 'adults') {
      return isAdultOnlyContent(item) || isTeenContent(item);
    }

    // 'all' audience — exclude kids content so adult books aren't mixed
    // with children's books. Kids content only shows in 'kids' mode.
    if (isKidsContent(item)) return false;

    // Apply age/rating filters if set
    if (selectedAges.length > 0 || selectedRatings.length > 0) {
      const matchesAge = selectedAges.length > 0 ? matchesSelectedAges(item, selectedAges) : true;
      const matchesRating = selectedRatings.length > 0 ? matchesSelectedRatings(item, selectedRatings) : true;
      return matchesAge && matchesRating;
    }

    return true;
  });
}

// =============================================================================
// Store
// =============================================================================

export const useContentFilterStore = create<ContentFilterState>()(
  persist(
    (set, get) => ({
      audience: 'all',
      selectedAges: [],
      selectedRatings: [],
      selectedTags: [],
      selectedGenres: [],
      lengthRange: null,

      setAudience: (audience) => {
        // When switching to kids, default to 10 and under
        if (audience === 'kids' && get().audience !== 'kids') {
          set({ audience, selectedAges: DEFAULT_KIDS_AGES, selectedRatings: [] });
        } else if (audience !== 'kids') {
          // Clear age filters when leaving kids mode (keep tags)
          set({ audience, selectedAges: [], selectedRatings: [] });
        } else {
          set({ audience });
        }
      },

      toggleAge: (age) => {
        const currentAges = get().selectedAges;
        if (currentAges.includes(age)) {
          set({ selectedAges: currentAges.filter((a) => a !== age) });
        } else {
          set({ selectedAges: [...currentAges, age] });
        }
      },

      toggleRating: (rating) => {
        const currentRatings = get().selectedRatings;
        if (currentRatings.includes(rating)) {
          set({ selectedRatings: currentRatings.filter((r) => r !== rating) });
        } else {
          set({ selectedRatings: [...currentRatings, rating] });
        }
      },

      toggleTag: (tag) => {
        const currentTags = get().selectedTags;
        if (currentTags.includes(tag)) {
          set({ selectedTags: currentTags.filter((t) => t !== tag) });
        } else {
          set({ selectedTags: [...currentTags, tag] });
        }
      },

      toggleGenre: (genre) => {
        const currentGenres = get().selectedGenres;
        if (currentGenres.includes(genre)) {
          set({ selectedGenres: currentGenres.filter((g) => g !== genre) });
        } else {
          set({ selectedGenres: [...currentGenres, genre] });
        }
      },

      setSelectedAges: (ages) => set({ selectedAges: ages }),

      setSelectedRatings: (ratings) => set({ selectedRatings: ratings }),

      setSelectedTags: (tags) => set({ selectedTags: tags }),

      setSelectedGenres: (genres) => set({ selectedGenres: genres }),

      setLengthRange: (range) => set({ lengthRange: range }),

      clearTags: () => set({ selectedTags: [], selectedGenres: [], lengthRange: null }),

      reset: () => set({ audience: 'all', selectedAges: [], selectedRatings: [], selectedTags: [], selectedGenres: [], lengthRange: null }),

      resetFilters: () => set({ selectedAges: [], selectedRatings: [], selectedTags: [], selectedGenres: [], lengthRange: null }),
    }),
    {
      name: 'content-filter-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to get filtered items based on current content filter settings
 */
export function useFilteredItems(items: LibraryItem[]): LibraryItem[] {
  const audience = useContentFilterStore((s) => s.audience);
  const selectedAges = useContentFilterStore((s) => s.selectedAges);
  const selectedRatings = useContentFilterStore((s) => s.selectedRatings);
  const selectedTags = useContentFilterStore((s) => s.selectedTags);
  const selectedGenres = useContentFilterStore((s) => s.selectedGenres);
  const lengthRange = useContentFilterStore((s) => s.lengthRange);

  return filterByAudience(items, audience, selectedAges, selectedRatings, selectedTags, lengthRange, selectedGenres);
}
