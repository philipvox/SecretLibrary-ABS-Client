/**
 * src/features/recommendations/hooks/useRecommendations.ts
 * 
 * Generate personalized recommendations based on user preferences
 */

import { useMemo } from 'react';
import { LibraryItem } from '@/core/types';
import { usePreferencesStore } from '../stores/preferencesStore';
import { useMyLibraryStore } from '@/features/library';
import { getGenres, getAuthorName, getNarratorName, getSeriesName, getDuration } from '@/shared/utils/metadata';

interface ScoredItem {
  item: LibraryItem;
  score: number;
  reasons: string[];
}

export function useRecommendations(allItems: LibraryItem[], limit: number = 20) {
  const preferences = usePreferencesStore();
  const { libraryIds } = useMyLibraryStore();

  const recommendations = useMemo(() => {
    if (!allItems.length) return [];

    // Filter out items already in user's library
    const availableItems = allItems.filter(item => !libraryIds.includes(item.id));

    // Score each item
    const scoredItems: ScoredItem[] = availableItems.map(item => {
      let score = 0;
      const reasons: string[] = [];

      const genres = getGenres(item);
      const author = getAuthorName(item);
      const narrator = getNarratorName(item);
      const series = getSeriesName(item);
      const duration = getDuration(item);

      // Genre matching (highest weight)
      const matchingGenres = genres.filter(g => 
        preferences.favoriteGenres.some(fg => 
          g.toLowerCase().includes(fg.toLowerCase()) ||
          fg.toLowerCase().includes(g.toLowerCase())
        )
      );
      if (matchingGenres.length > 0) {
        score += matchingGenres.length * 30;
        reasons.push(`Matches your interest in ${matchingGenres[0]}`);
      }

      // Author matching
      if (preferences.favoriteAuthors.some(a => 
        author.toLowerCase().includes(a.toLowerCase())
      )) {
        score += 25;
        reasons.push(`By ${author}`);
      }

      // Narrator matching
      if (preferences.favoriteNarrators.some(n => 
        narrator.toLowerCase().includes(n.toLowerCase())
      )) {
        score += 20;
        reasons.push(`Narrated by ${narrator}`);
      }

      // Series preference
      if (preferences.prefersSeries !== null) {
        const isSeries = !!series;
        if (preferences.prefersSeries === isSeries) {
          score += 10;
          if (isSeries) reasons.push('Part of a series');
        }
      }

      // Duration preference
      const hours = duration / 3600;
      if (preferences.preferredLength !== 'any') {
        if (preferences.preferredLength === 'short' && hours <= 8) {
          score += 10;
        } else if (preferences.preferredLength === 'medium' && hours > 8 && hours <= 20) {
          score += 10;
        } else if (preferences.preferredLength === 'long' && hours > 20) {
          score += 10;
        }
      }

      // Mood matching
      preferences.moods.forEach(mood => {
        const moodGenres = MOOD_GENRE_MAP[mood] || [];
        if (genres.some(g => moodGenres.some(mg => 
          g.toLowerCase().includes(mg.toLowerCase())
        ))) {
          score += 15;
          if (!reasons.some(r => r.includes('mood'))) {
            reasons.push(`Great for ${mood.toLowerCase()} reading`);
          }
        }
      });

      // Small random factor for variety
      score += Math.random() * 5;

      return { item, score, reasons };
    });

    // Sort by score and return top items
    return scoredItems
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }, [allItems, preferences, libraryIds, limit]);

  // Group recommendations by reason
  const groupedRecommendations = useMemo(() => {
    const groups: Record<string, LibraryItem[]> = {
      'Based on your genres': [],
      'Authors you might like': [],
      'Great narrators': [],
    };

    recommendations.forEach(({ item, reasons }) => {
      if (reasons.some(r => r.includes('interest'))) {
        groups['Based on your genres'].push(item);
      } else if (reasons.some(r => r.startsWith('By '))) {
        groups['Authors you might like'].push(item);
      } else if (reasons.some(r => r.includes('Narrated'))) {
        groups['Great narrators'].push(item);
      }
    });

    return Object.entries(groups)
      .filter(([_, items]) => items.length > 0)
      .map(([title, items]) => ({ title, items: items.slice(0, 10) }));
  }, [recommendations]);

  return {
    recommendations: recommendations.map(r => r.item),
    scoredRecommendations: recommendations,
    groupedRecommendations,
    hasPreferences: preferences.hasCompletedOnboarding,
  };
}

// Map moods to genres
const MOOD_GENRE_MAP: Record<string, string[]> = {
  'Adventurous': ['adventure', 'action', 'thriller', 'fantasy', 'sci-fi'],
  'Relaxing': ['cozy', 'romance', 'slice of life', 'contemporary'],
  'Thoughtful': ['literary', 'philosophy', 'biography', 'history'],
  'Escapist': ['fantasy', 'sci-fi', 'paranormal', 'urban fantasy'],
  'Suspenseful': ['thriller', 'mystery', 'horror', 'suspense', 'crime'],
  'Romantic': ['romance', 'contemporary romance', 'historical romance'],
  'Educational': ['non-fiction', 'history', 'science', 'self-help', 'business'],
  'Funny': ['humor', 'comedy', 'satire', 'comedic'],
};