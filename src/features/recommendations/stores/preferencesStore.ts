/**
 * src/features/recommendations/stores/preferencesStore.ts
 * 
 * User preferences for generating recommendations
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserPreferences {
  // Genres/tags the user likes
  favoriteGenres: string[];
  
  // Preferred audiobook length
  preferredLength: 'short' | 'medium' | 'long' | 'any';
  
  // Favorite authors (by name)
  favoriteAuthors: string[];
  
  // Favorite narrators (by name)
  favoriteNarrators: string[];
  
  // Prefers series or standalone
  prefersSeries: boolean | null;
  
  // Has completed onboarding
  hasCompletedOnboarding: boolean;
  
  // Mood preferences
  moods: string[];
}

interface PreferencesState extends UserPreferences {
  // Actions
  setFavoriteGenres: (genres: string[]) => void;
  toggleGenre: (genre: string) => void;
  setPreferredLength: (length: UserPreferences['preferredLength']) => void;
  setFavoriteAuthors: (authors: string[]) => void;
  toggleAuthor: (author: string) => void;
  setFavoriteNarrators: (narrators: string[]) => void;
  toggleNarrator: (narrator: string) => void;
  setPrefersSeries: (value: boolean | null) => void;
  setMoods: (moods: string[]) => void;
  toggleMood: (mood: string) => void;
  completeOnboarding: () => void;
  resetPreferences: () => void;
}

const initialState: UserPreferences = {
  favoriteGenres: [],
  preferredLength: 'any',
  favoriteAuthors: [],
  favoriteNarrators: [],
  prefersSeries: null,
  hasCompletedOnboarding: false,
  moods: [],
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setFavoriteGenres: (genres) => set({ favoriteGenres: genres }),
      
      toggleGenre: (genre) => {
        const { favoriteGenres } = get();
        if (favoriteGenres.includes(genre)) {
          set({ favoriteGenres: favoriteGenres.filter(g => g !== genre) });
        } else {
          set({ favoriteGenres: [...favoriteGenres, genre] });
        }
      },

      setPreferredLength: (length) => set({ preferredLength: length }),

      setFavoriteAuthors: (authors) => set({ favoriteAuthors: authors }),
      
      toggleAuthor: (author) => {
        const { favoriteAuthors } = get();
        if (favoriteAuthors.includes(author)) {
          set({ favoriteAuthors: favoriteAuthors.filter(a => a !== author) });
        } else {
          set({ favoriteAuthors: [...favoriteAuthors, author] });
        }
      },

      setFavoriteNarrators: (narrators) => set({ favoriteNarrators: narrators }),
      
      toggleNarrator: (narrator) => {
        const { favoriteNarrators } = get();
        if (favoriteNarrators.includes(narrator)) {
          set({ favoriteNarrators: favoriteNarrators.filter(n => n !== narrator) });
        } else {
          set({ favoriteNarrators: [...favoriteNarrators, narrator] });
        }
      },

      setPrefersSeries: (value) => set({ prefersSeries: value }),

      setMoods: (moods) => set({ moods }),
      
      toggleMood: (mood) => {
        const { moods } = get();
        if (moods.includes(mood)) {
          set({ moods: moods.filter(m => m !== mood) });
        } else {
          set({ moods: [...moods, mood] });
        }
      },

      completeOnboarding: () => set({ hasCompletedOnboarding: true }),

      resetPreferences: () => set(initialState),
    }),
    {
      name: 'user-preferences-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);