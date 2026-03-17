/**
 * src/shared/utils/bookDNA/feelingScoring.ts
 *
 * Scoring engine for Feeling Chips on the Discover tab.
 * Each chip has a set of scoring rules based on BookDNA mood scores,
 * spectrum values, genres, and tags. Score range 0-5.
 * Books with score >= 2 are shown, sorted descending.
 */

import { parseBookDNA, BookDNA } from './parseBookDNA';
import { LibraryItem } from '@/core/types';
import type { FeelingChip } from '@/features/browse/stores/feelingChipStore';

// ============================================================================
// CACHED ITEM DATA — avoids re-parsing BookDNA per chip per item
// ============================================================================

interface CachedItemData {
  dna: BookDNA;
  genres: string[];
  plainTags: string[];
}

const itemDataCache = new Map<string, CachedItemData>();

/** Clear the cache when library changes (call on refresh) */
export function clearFeelingCache(): void {
  itemDataCache.clear();
}

function getCachedItemData(item: LibraryItem): CachedItemData {
  const cached = itemDataCache.get(item.id);
  if (cached) return cached;

  const allTags = ((item.media as any)?.tags || []).map((t: string) => t.toLowerCase());
  const dna = parseBookDNA(allTags);
  const metadata = (item.media as any)?.metadata;
  const genres = metadata?.genres ? metadata.genres.map((g: string) => g.toLowerCase()) : [];
  const plainTags = allTags.filter((t: string) => !t.startsWith('dna:'));

  const data: CachedItemData = { dna, genres, plainTags };
  itemDataCache.set(item.id, data);
  return data;
}

// ============================================================================
// HELPERS
// ============================================================================

function hasAnyGenre(genres: string[], targets: string[]): boolean {
  return targets.some((t) => genres.some((g) => g.includes(t)));
}

function hasAnyTag(tags: string[], targets: string[]): boolean {
  return targets.some((t) => tags.includes(t));
}

// ============================================================================
// SCORING
// ============================================================================

/**
 * Score a library item for a given feeling chip.
 * Returns 0-5 (sum of up to 4 scoring criteria, each worth +1 or +2).
 * Uses per-item cache to avoid re-parsing BookDNA for each chip.
 */
export function scoreFeelingChip(item: LibraryItem, chip: FeelingChip): number {
  const { dna, genres, plainTags } = getCachedItemData(item);

  let score = 0;

  switch (chip) {
    case 'thrilling':
      if ((dna.moodScores.thrills ?? 0) >= 0.6) score += 2;
      if (hasAnyGenre(genres, ['thriller', 'suspense', 'mystery'])) score += 1;
      if (hasAnyTag(plainTags, ['suspenseful', 'tense'])) score += 1;
      if ((dna.spectrums.darkLight ?? 0) < -0.3) score += 1;
      break;

    case 'funny':
      if ((dna.moodScores.laughs ?? 0) >= 0.5) score += 2;
      if (hasAnyGenre(genres, ['humor', 'comedy', 'satire'])) score += 1;
      if (hasAnyTag(plainTags, ['funny', 'lighthearted', 'witty'])) score += 1;
      if ((dna.spectrums.seriousHumorous ?? 0) > 0.3) score += 1;
      break;

    case 'dark':
      if ((dna.spectrums.darkLight ?? 0) < -0.5) score += 2;
      if (hasAnyGenre(genres, ['horror', 'gothic', 'noir', 'crime'])) score += 1;
      if (hasAnyTag(plainTags, ['dark', 'haunting', 'gritty'])) score += 1;
      if ((dna.moodScores.thrills ?? 0) >= 0.5) score += 1;
      break;

    case 'heartwarming':
      if ((dna.moodScores.heart ?? 0) >= 0.6) score += 2;
      if (hasAnyGenre(genres, ['romance', 'family'])) score += 1;
      if (hasAnyTag(plainTags, ['heartwarming', 'uplifting', 'feel-good'])) score += 1;
      if ((dna.moodScores.drama ?? 0) >= 0.4) score += 1;
      break;

    case 'escapist':
      if ((dna.moodScores.wonder ?? 0) >= 0.6) score += 2;
      if (hasAnyGenre(genres, ['fantasy', 'sci-fi', 'science fiction', 'adventure'])) score += 1;
      if (hasAnyTag(plainTags, ['adventurous', 'whimsical', 'escapist'])) score += 1;
      if ((dna.spectrums.darkLight ?? 0) > 0.3) score += 1;
      break;

    case 'thought-provoking':
      if ((dna.moodScores.ideas ?? 0) >= 0.5) score += 2;
      if (hasAnyGenre(genres, ['literary', 'literary fiction', 'philosophy', 'history'])) score += 1;
      if (hasAnyTag(plainTags, ['thought-provoking', 'inspiring'])) score += 1;
      if ((dna.spectrums.seriousHumorous ?? 0) < -0.3) score += 1;
      break;

    case 'cozy':
      if (hasAnyTag(plainTags, ['cozy', 'lighthearted', 'feel-good'])) score += 2;
      if (hasAnyGenre(genres, ['romance', 'cozy mystery', 'cozy'])) score += 1;
      if ((dna.moodScores.heart ?? 0) >= 0.4) score += 1;
      if ((dna.spectrums.darkLight ?? 0) > 0.2) score += 1;
      break;

    case 'intense':
      if ((dna.moodScores.thrills ?? 0) >= 0.5 && (dna.moodScores.drama ?? 0) >= 0.5) score += 2;
      if (hasAnyGenre(genres, ['thriller', 'war', 'crime'])) score += 1;
      if (hasAnyTag(plainTags, ['intense', 'tense', 'suspenseful'])) score += 1;
      if ((dna.spectrums.darkLight ?? 0) < -0.2) score += 1;
      break;
  }

  return Math.min(score, 5);
}

/**
 * Filter and sort items by feeling chip score.
 * Returns items with score >= 2, sorted by score descending.
 */
export function filterByFeeling(items: LibraryItem[], chip: FeelingChip): LibraryItem[] {
  const scored = items
    .map((item) => ({ item, score: scoreFeelingChip(item, chip) }))
    .filter(({ score }) => score >= 2)
    .sort((a, b) => b.score - a.score);

  return scored.map(({ item }) => item);
}
