/**
 * src/features/recommendations/hooks/useRecommendations.ts
 *
 * Generate personalized recommendations based on user preferences
 * and reading history (completed books have higher weight)
 */

import { useMemo, useState, useEffect } from 'react';
import { LibraryItem } from '@/core/types';
import { usePreferencesStore } from '../stores/preferencesStore';
import { useMyLibraryStore } from '@/features/library';
import { sqliteCache } from '@/core/services/sqliteCache';
import { getGenres, getAuthorName, getNarratorName, getSeriesName, getDuration } from '@/shared/utils/metadata';

interface ReadHistoryStats {
  totalBooksRead: number;
  favoriteAuthors: { name: string; count: number }[];
  favoriteNarrators: { name: string; count: number }[];
  favoriteGenres: { name: string; count: number }[];
}

interface ScoredItem {
  item: LibraryItem;
  score: number;
  reasons: string[];
}

export function useRecommendations(allItems: LibraryItem[], limit: number = 20) {
  const preferences = usePreferencesStore();
  const { libraryIds } = useMyLibraryStore();

  // Load read history stats for weighted scoring
  const [historyStats, setHistoryStats] = useState<ReadHistoryStats | null>(null);

  useEffect(() => {
    sqliteCache.getReadHistoryStats().then(setHistoryStats).catch(() => {});
  }, []);

  const recommendations = useMemo(() => {
    if (!allItems.length) return [];

    // Filter out items already in user's library
    const availableItems = allItems.filter(item => !libraryIds.includes(item.id));

    // Create lookup maps for history-based scoring
    const historyAuthorWeights = new Map<string, number>();
    const historyNarratorWeights = new Map<string, number>();
    const historyGenreWeights = new Map<string, number>();

    if (historyStats) {
      historyStats.favoriteAuthors.forEach(({ name, count }) => {
        historyAuthorWeights.set(name.toLowerCase(), count);
      });
      historyStats.favoriteNarrators.forEach(({ name, count }) => {
        historyNarratorWeights.set(name.toLowerCase(), count);
      });
      historyStats.favoriteGenres.forEach(({ name, count }) => {
        historyGenreWeights.set(name.toLowerCase(), count);
      });
    }

    // Score each item
    const scoredItems: ScoredItem[] = availableItems.map(item => {
      let score = 0;
      const reasons: string[] = [];

      const genres = getGenres(item);
      const author = getAuthorName(item);
      const narrator = getNarratorName(item);
      const series = getSeriesName(item);
      const duration = getDuration(item);

      // === READ HISTORY BOOSTING (highest priority - based on completed books) ===

      // Author boost from read history (weight: 40 * multiplier based on times read)
      const authorHistoryWeight = historyAuthorWeights.get(author.toLowerCase()) || 0;
      if (authorHistoryWeight > 0) {
        const boost = Math.min(40 + authorHistoryWeight * 10, 80); // Cap at 80
        score += boost;
        reasons.push(`More by ${author} (you've read ${authorHistoryWeight} of their books)`);
      }

      // Narrator boost from read history
      const narratorHistoryWeight = historyNarratorWeights.get(narrator.toLowerCase()) || 0;
      if (narratorHistoryWeight > 0) {
        const boost = Math.min(30 + narratorHistoryWeight * 8, 60); // Cap at 60
        score += boost;
        if (!reasons.some(r => r.includes(narrator))) {
          reasons.push(`Narrated by ${narrator} (${narratorHistoryWeight} books you've enjoyed)`);
        }
      }

      // Genre boost from read history
      let genreHistoryBoost = 0;
      genres.forEach(g => {
        const weight = historyGenreWeights.get(g.toLowerCase()) || 0;
        if (weight > 0) {
          genreHistoryBoost += Math.min(weight * 5, 25); // Cap per genre at 25
        }
      });
      if (genreHistoryBoost > 0) {
        score += Math.min(genreHistoryBoost, 50); // Total cap at 50
        if (!reasons.some(r => r.includes('interest') || r.includes('read'))) {
          reasons.push('Similar to books you\'ve finished');
        }
      }

      // === PREFERENCE-BASED SCORING ===

      // Genre matching from preferences
      const matchingGenres = genres.filter(g =>
        preferences.favoriteGenres.some(fg =>
          g.toLowerCase().includes(fg.toLowerCase()) ||
          fg.toLowerCase().includes(g.toLowerCase())
        )
      );
      if (matchingGenres.length > 0 && !reasons.some(r => r.includes('interest'))) {
        score += matchingGenres.length * 30;
        reasons.push(`Matches your interest in ${matchingGenres[0]}`);
      }

      // Author matching from preferences
      if (preferences.favoriteAuthors.some(a =>
        author.toLowerCase().includes(a.toLowerCase())
      ) && !reasons.some(r => r.includes(author))) {
        score += 25;
        reasons.push(`By ${author}`);
      }

      // Narrator matching from preferences
      if (preferences.favoriteNarrators.some(n =>
        narrator.toLowerCase().includes(n.toLowerCase())
      ) && !reasons.some(r => r.includes(narrator))) {
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
  }, [allItems, preferences, libraryIds, limit, historyStats]);

  // Group recommendations by reason
  const groupedRecommendations = useMemo(() => {
    const groups: Record<string, LibraryItem[]> = {
      'Based on your reading history': [],
      'Based on your genres': [],
      'Authors you might like': [],
      'Great narrators': [],
    };

    recommendations.forEach(({ item, reasons }) => {
      // Prioritize read history matches
      if (reasons.some(r => r.includes("you've read") || r.includes("you've finished") || r.includes("you've enjoyed"))) {
        groups['Based on your reading history'].push(item);
      } else if (reasons.some(r => r.includes('interest'))) {
        groups['Based on your genres'].push(item);
      } else if (reasons.some(r => r.startsWith('By ') || r.startsWith('More by'))) {
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