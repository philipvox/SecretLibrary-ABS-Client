/**
 * src/shared/stores/kidModeStore.ts
 *
 * Store for Kid Mode preference.
 * When enabled, filters content to show only kid-friendly audiobooks.
 * Users can customize allowed genres, tags, and age threshold.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// DEFAULT VALUES
// ============================================================================

/** Age category levels (ordered from youngest to oldest) */
export type AgeCategory = 'childrens' | 'teens' | 'young-adult' | 'adult';

/** Age category labels for display */
export const AGE_CATEGORY_LABELS: Record<AgeCategory, string> = {
  childrens: "Children's",
  teens: 'Teens',
  'young-adult': 'Young Adult',
  adult: 'Adult',
};

/** Age category order (index = restrictiveness, lower = younger) */
export const AGE_CATEGORY_ORDER: AgeCategory[] = ['childrens', 'teens', 'young-adult', 'adult'];

/** Tags that map to each age category */
export const AGE_CATEGORY_TAGS: Record<AgeCategory, string[]> = {
  childrens: ["children's", 'childrens', 'children', 'kids', 'juvenile', 'middle grade', 'picture books'],
  teens: ['teens', 'teen', 'teen fiction'],
  'young-adult': ['young adult', 'young-adult', 'ya'],
  adult: ['adult', 'adult fiction', 'mature', '18+'],
};

/** Default max age category */
export const DEFAULT_MAX_AGE_CATEGORY: AgeCategory = 'childrens';

/** Content rating levels (ordered from most restrictive to least) */
export type ContentRating = 'g' | 'pg' | 'pg-13' | 'r';

/** Content rating labels for display */
export const RATING_LABELS: Record<ContentRating, string> = {
  g: 'G',
  pg: 'PG',
  'pg-13': 'PG-13',
  r: 'R',
};

/** Content rating order (index = restrictiveness, lower = more restrictive) */
export const RATING_ORDER: ContentRating[] = ['g', 'pg', 'pg-13', 'r'];

/** Tags that map to each content rating */
export const RATING_TAGS: Record<ContentRating, string[]> = {
  g: ['g', 'rated g', 'rating: g', 'general audience', 'all ages'],
  pg: ['pg', 'rated pg', 'rating: pg', 'parental guidance'],
  'pg-13': ['pg-13', 'pg13', 'rated pg-13', 'rating: pg-13', '13+'],
  r: ['r', 'rated r', 'rating: r', 'mature', '17+', '18+'],
};

/** Default max content rating */
export const DEFAULT_MAX_RATING: ContentRating = 'g';

/**
 * Default kid-friendly genres to INCLUDE when Kid Mode is enabled.
 * Users can customize this list in Kid Mode Settings.
 */
export const DEFAULT_ALLOWED_GENRES = [
  'children',
  "children's",
  'childrens',
  'kids',
  'middle grade',
  'picture books',
  'juvenile',
];

/**
 * Default kid-friendly tags to INCLUDE when Kid Mode is enabled.
 * Books with these tags will be shown.
 */
export const DEFAULT_ALLOWED_TAGS = [
  'kids',
  'children',
  'family',
  'family-friendly',
  'all-ages',
  'kid-friendly',
  'child-friendly',
];

/**
 * Genres to ALWAYS block in Kid Mode (even if book has allowed genre).
 * These indicate adult content that shouldn't appear.
 */
export const DEFAULT_BLOCKED_GENRES = [
  'erotica',
  'erotic',
  'adult',
  'romance',
  'dark romance',
  'dark fantasy',
  'grimdark',
  'horror',
  'thriller',
  'true crime',
  'paranormal romance',
  'new adult',
  'na',
  'mature',
  '18+',
  'adult fiction',
  'young adult',
  'ya',
  'teen',
  'teen fiction',
];

/**
 * Tags to ALWAYS block in Kid Mode.
 */
export const DEFAULT_BLOCKED_TAGS = [
  'adult',
  'mature',
  'explicit',
  '18+',
  'nsfw',
  'dark',
  'grimdark',
  'violent',
  'gore',
];

// ============================================================================
// PIN CONSTANTS
// ============================================================================

/** Number of failed PIN attempts before lockout */
export const MAX_PIN_ATTEMPTS = 3;

/** Lockout duration in milliseconds (30 seconds) */
export const PIN_LOCKOUT_DURATION = 30 * 1000;

// ============================================================================
// TYPES
// ============================================================================

interface KidModeState {
  /** Whether Kid Mode is enabled */
  enabled: boolean;

  /** Whether to use age category filtering (from tags like Children's, Teens, etc.) */
  useAgeFiltering: boolean;

  /** Maximum age category allowed (childrens, teens, young-adult, adult) */
  maxAgeCategory: AgeCategory;

  /** Whether to use content rating filtering (G, PG, PG-13, R) */
  useRatingFiltering: boolean;

  /** Maximum content rating allowed */
  maxRating: ContentRating;

  /** Whether to require allowed genres/tags (when false, only blocked items are checked) */
  useAllowedGenresTags: boolean;

  /** Genres that are allowed in Kid Mode (customizable) */
  allowedGenres: string[];

  /** Tags that are allowed in Kid Mode (customizable) */
  allowedTags: string[];

  /** Genres that are blocked in Kid Mode (customizable) */
  blockedGenres: string[];

  /** Tags that are blocked in Kid Mode (customizable) */
  blockedTags: string[];

  // PIN Protection
  /** 4-digit PIN for Kid Mode (null if not set) */
  pin: string | null;

  /** Number of consecutive failed PIN attempts */
  pinFailedAttempts: number;

  /** Timestamp when lockout ends (null if not locked) */
  pinLockoutUntil: number | null;

  // Actions
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
  setUseAgeFiltering: (useAgeFiltering: boolean) => void;
  setMaxAgeCategory: (category: AgeCategory) => void;
  setUseRatingFiltering: (useRatingFiltering: boolean) => void;
  setMaxRating: (rating: ContentRating) => void;
  setUseAllowedGenresTags: (use: boolean) => void;

  // Genre management
  addAllowedGenre: (genre: string) => void;
  removeAllowedGenre: (genre: string) => void;
  addBlockedGenre: (genre: string) => void;
  removeBlockedGenre: (genre: string) => void;

  // Tag management
  addAllowedTag: (tag: string) => void;
  removeAllowedTag: (tag: string) => void;
  addBlockedTag: (tag: string) => void;
  removeBlockedTag: (tag: string) => void;

  // Reset to defaults
  resetToDefaults: () => void;

  // PIN Management
  /** Set a 4-digit PIN (must be exactly 4 digits) */
  setPin: (pin: string) => boolean;
  /** Remove PIN protection (does not require verification - caller should verify first) */
  removePin: () => void;
  /** Verify if the provided PIN matches. Returns true if correct, false otherwise. */
  verifyPin: (pin: string) => boolean;
  /** Disable Kid Mode. Requires PIN if one is set. Returns true if successful. */
  disableKidMode: (pin?: string) => boolean;
  /** Check if currently locked out due to too many failed attempts */
  isLockedOut: () => boolean;
  /** Get remaining lockout time in seconds (0 if not locked) */
  getLockoutRemaining: () => number;
  /** Clear lockout state (for internal use after lockout expires) */
  clearLockout: () => void;
}

// ============================================================================
// STORE
// ============================================================================

export const useKidModeStore = create<KidModeState>()(
  persist(
    (set, get) => ({
      enabled: false,
      useAgeFiltering: true,
      maxAgeCategory: DEFAULT_MAX_AGE_CATEGORY,
      useRatingFiltering: true,
      maxRating: DEFAULT_MAX_RATING,
      useAllowedGenresTags: true,
      allowedGenres: [...DEFAULT_ALLOWED_GENRES],
      allowedTags: [...DEFAULT_ALLOWED_TAGS],
      blockedGenres: [...DEFAULT_BLOCKED_GENRES],
      blockedTags: [...DEFAULT_BLOCKED_TAGS],

      // PIN state
      pin: null,
      pinFailedAttempts: 0,
      pinLockoutUntil: null,

      setEnabled: (enabled) => set({ enabled }),
      toggle: () => set({ enabled: !get().enabled }),
      setUseAgeFiltering: (useAgeFiltering) => set({ useAgeFiltering }),
      setMaxAgeCategory: (maxAgeCategory) => set({ maxAgeCategory }),
      setUseRatingFiltering: (useRatingFiltering) => set({ useRatingFiltering }),
      setMaxRating: (maxRating) => set({ maxRating }),
      setUseAllowedGenresTags: (useAllowedGenresTags) => set({ useAllowedGenresTags }),

      // Genre management
      addAllowedGenre: (genre) => {
        const normalized = genre.toLowerCase().trim();
        if (!normalized) return;
        const current = get().allowedGenres;
        if (!current.includes(normalized)) {
          set({ allowedGenres: [...current, normalized] });
        }
      },
      removeAllowedGenre: (genre) => {
        const normalized = genre.toLowerCase().trim();
        set({ allowedGenres: get().allowedGenres.filter((g) => g !== normalized) });
      },
      addBlockedGenre: (genre) => {
        const normalized = genre.toLowerCase().trim();
        if (!normalized) return;
        const current = get().blockedGenres;
        if (!current.includes(normalized)) {
          set({ blockedGenres: [...current, normalized] });
        }
      },
      removeBlockedGenre: (genre) => {
        const normalized = genre.toLowerCase().trim();
        set({ blockedGenres: get().blockedGenres.filter((g) => g !== normalized) });
      },

      // Tag management
      addAllowedTag: (tag) => {
        const normalized = tag.toLowerCase().trim();
        if (!normalized) return;
        const current = get().allowedTags;
        if (!current.includes(normalized)) {
          set({ allowedTags: [...current, normalized] });
        }
      },
      removeAllowedTag: (tag) => {
        const normalized = tag.toLowerCase().trim();
        set({ allowedTags: get().allowedTags.filter((t) => t !== normalized) });
      },
      addBlockedTag: (tag) => {
        const normalized = tag.toLowerCase().trim();
        if (!normalized) return;
        const current = get().blockedTags;
        if (!current.includes(normalized)) {
          set({ blockedTags: [...current, normalized] });
        }
      },
      removeBlockedTag: (tag) => {
        const normalized = tag.toLowerCase().trim();
        set({ blockedTags: get().blockedTags.filter((t) => t !== normalized) });
      },

      // Reset
      resetToDefaults: () =>
        set({
          useAgeFiltering: true,
          maxAgeCategory: DEFAULT_MAX_AGE_CATEGORY,
          useRatingFiltering: true,
          maxRating: DEFAULT_MAX_RATING,
          useAllowedGenresTags: true,
          allowedGenres: [...DEFAULT_ALLOWED_GENRES],
          allowedTags: [...DEFAULT_ALLOWED_TAGS],
          blockedGenres: [...DEFAULT_BLOCKED_GENRES],
          blockedTags: [...DEFAULT_BLOCKED_TAGS],
        }),

      // PIN Management
      setPin: (pin: string) => {
        // Validate: must be exactly 4 digits
        if (!/^\d{4}$/.test(pin)) {
          return false;
        }
        set({ pin, pinFailedAttempts: 0, pinLockoutUntil: null });
        return true;
      },

      removePin: () => {
        set({ pin: null, pinFailedAttempts: 0, pinLockoutUntil: null });
      },

      verifyPin: (pin: string) => {
        const state = get();

        // Check if locked out
        if (state.pinLockoutUntil && Date.now() < state.pinLockoutUntil) {
          return false;
        }

        // Clear expired lockout
        if (state.pinLockoutUntil && Date.now() >= state.pinLockoutUntil) {
          set({ pinLockoutUntil: null, pinFailedAttempts: 0 });
        }

        // No PIN set means any PIN is "correct" (shouldn't happen in practice)
        if (!state.pin) {
          return true;
        }

        // Check PIN
        if (pin === state.pin) {
          // Correct - reset failed attempts
          set({ pinFailedAttempts: 0, pinLockoutUntil: null });
          return true;
        }

        // Wrong PIN - increment failed attempts
        const newAttempts = state.pinFailedAttempts + 1;
        if (newAttempts >= MAX_PIN_ATTEMPTS) {
          // Lock out for 30 seconds
          set({
            pinFailedAttempts: newAttempts,
            pinLockoutUntil: Date.now() + PIN_LOCKOUT_DURATION,
          });
        } else {
          set({ pinFailedAttempts: newAttempts });
        }
        return false;
      },

      disableKidMode: (pin?: string) => {
        const state = get();

        // If PIN is set, require verification
        if (state.pin) {
          if (!pin) {
            return false; // PIN required but not provided
          }
          if (!get().verifyPin(pin)) {
            return false; // Wrong PIN
          }
        }

        // Success - disable Kid Mode
        set({ enabled: false });
        return true;
      },

      isLockedOut: () => {
        const state = get();
        if (!state.pinLockoutUntil) return false;

        // Check if lockout has expired
        if (Date.now() >= state.pinLockoutUntil) {
          // Clear expired lockout
          set({ pinLockoutUntil: null, pinFailedAttempts: 0 });
          return false;
        }
        return true;
      },

      getLockoutRemaining: () => {
        const state = get();
        if (!state.pinLockoutUntil) return 0;

        const remaining = state.pinLockoutUntil - Date.now();
        if (remaining <= 0) {
          set({ pinLockoutUntil: null, pinFailedAttempts: 0 });
          return 0;
        }
        return Math.ceil(remaining / 1000);
      },

      clearLockout: () => {
        set({ pinLockoutUntil: null, pinFailedAttempts: 0 });
      },
    }),
    {
      name: 'kid-mode-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

/** Get enabled state (for use outside React components) */
export function isKidModeEnabled(): boolean {
  return useKidModeStore.getState().enabled;
}

/** Get all Kid Mode settings (for filter logic) */
export function getKidModeSettings() {
  const state = useKidModeStore.getState();
  return {
    enabled: state.enabled,
    useAgeFiltering: state.useAgeFiltering,
    maxAgeCategory: state.maxAgeCategory,
    useRatingFiltering: state.useRatingFiltering,
    maxRating: state.maxRating,
    useAllowedGenresTags: state.useAllowedGenresTags,
    allowedGenres: state.allowedGenres,
    allowedTags: state.allowedTags,
    blockedGenres: state.blockedGenres,
    blockedTags: state.blockedTags,
  };
}

/** Hook to get Kid Mode filter settings */
export function useKidModeSettings() {
  return useKidModeStore(
    useShallow((s) => ({
      enabled: s.enabled,
      useAgeFiltering: s.useAgeFiltering,
      maxAgeCategory: s.maxAgeCategory,
      useRatingFiltering: s.useRatingFiltering,
      maxRating: s.maxRating,
      useAllowedGenresTags: s.useAllowedGenresTags,
      allowedGenres: s.allowedGenres,
      allowedTags: s.allowedTags,
      blockedGenres: s.blockedGenres,
      blockedTags: s.blockedTags,
    }))
  );
}
