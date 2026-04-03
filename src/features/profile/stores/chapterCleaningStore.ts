/**
 * src/features/profile/stores/chapterCleaningStore.ts
 *
 * Store for chapter name cleaning preferences.
 * Controls how messy chapter names are normalized for display.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// TYPES
// ============================================================================

export type ChapterCleaningLevel = 'off' | 'light' | 'standard' | 'aggressive';

export interface ChapterCleaningSettings {
  /** Cleaning intensity level */
  level: ChapterCleaningLevel;
  /** Show original chapter names in a secondary line (for debugging) */
  showOriginalNames: boolean;
}

interface ChapterCleaningState extends ChapterCleaningSettings {
  // Actions
  setLevel: (level: ChapterCleaningLevel) => void;
  setShowOriginalNames: (show: boolean) => void;
  resetToDefaults: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default settings - standard cleaning enabled */
const DEFAULT_SETTINGS: ChapterCleaningSettings = {
  level: 'standard',
  showOriginalNames: false,
};

/** i18n key suffixes for each cleaning level */
export const CLEANING_LEVEL_KEYS: Record<
  ChapterCleaningLevel,
  { labelKey: string; descriptionKey: string; exampleKey: string }
> = {
  off: {
    labelKey: 'settings.playback.chapterCleaning.offLabel',
    descriptionKey: 'settings.playback.chapterCleaning.offDescription',
    exampleKey: 'settings.playback.chapterCleaning.offExample',
  },
  light: {
    labelKey: 'settings.playback.chapterCleaning.lightLabel',
    descriptionKey: 'settings.playback.chapterCleaning.lightDescription',
    exampleKey: 'settings.playback.chapterCleaning.lightExample',
  },
  standard: {
    labelKey: 'settings.playback.chapterCleaning.standardLabel',
    descriptionKey: 'settings.playback.chapterCleaning.standardDescription',
    exampleKey: 'settings.playback.chapterCleaning.standardExample',
  },
  aggressive: {
    labelKey: 'settings.playback.chapterCleaning.aggressiveLabel',
    descriptionKey: 'settings.playback.chapterCleaning.aggressiveDescription',
    exampleKey: 'settings.playback.chapterCleaning.aggressiveExample',
  },
};

// ============================================================================
// STORE
// ============================================================================

export const useChapterCleaningStore = create<ChapterCleaningState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setLevel: (level) => set({ level }),
      setShowOriginalNames: (showOriginalNames) => set({ showOriginalNames }),
      resetToDefaults: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'chapter-cleaning-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

/** Get all settings as a plain object */
export const useChapterCleaningSettings = () =>
  useChapterCleaningStore(
    useShallow((s) => ({
      level: s.level,
      showOriginalNames: s.showOriginalNames,
    }))
  );

/** Get just the cleaning level */
export const useChapterCleaningLevel = () =>
  useChapterCleaningStore((s) => s.level);

/** Get the cleaning level (for use outside React components) */
export function getChapterCleaningLevel(): ChapterCleaningLevel {
  return useChapterCleaningStore.getState().level;
}

/** Check if cleaning is enabled (not 'off') */
export function isChapterCleaningEnabled(): boolean {
  return useChapterCleaningStore.getState().level !== 'off';
}
