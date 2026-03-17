/**
 * src/shared/utils/bookDNA/vibeScoring.ts
 *
 * Pure scoring function for vibe sliders.
 * Scores books based on their spectrum values relative to slider positions.
 */

import { BookDNA } from './parseBookDNA';

/**
 * Score how well a book matches the current vibe slider positions.
 *
 * @param bookDNA - Parsed BookDNA for the book
 * @param darkLight - Slider value: -1 (dark) to +1 (light), 0 = neutral
 * @param seriousFunny - Slider value: -1 (serious) to +1 (funny), 0 = neutral
 * @returns 0-1 relevance score (1 = perfect match, 0 = opposite end)
 */
export function scoreBookByVibe(
  bookDNA: BookDNA,
  darkLight: number,
  seriousFunny: number,
): number {
  // Both sliders at center → all books equal
  if (darkLight === 0 && seriousFunny === 0) return 1.0;

  let totalWeight = 0;
  let totalDistance = 0;

  // Dark ↔ Light axis
  if (darkLight !== 0 && bookDNA.spectrums.darkLight !== null) {
    const distance = Math.abs(darkLight - bookDNA.spectrums.darkLight);
    // Distance is 0-2 (slider range -1 to +1), normalize to 0-1
    totalDistance += distance / 2;
    totalWeight += 1;
  }

  // Serious ↔ Funny axis
  if (seriousFunny !== 0 && bookDNA.spectrums.seriousHumorous !== null) {
    const distance = Math.abs(seriousFunny - bookDNA.spectrums.seriousHumorous);
    totalDistance += distance / 2;
    totalWeight += 1;
  }

  // No matching axes (book has no spectrum data for active sliders)
  if (totalWeight === 0) return 0.5;

  // Score = 1 - average normalized distance
  const avgDistance = totalDistance / totalWeight;
  return Math.max(0, 1 - avgDistance);
}

/**
 * Parse comp-vibe tags from a book's tags.
 * Format: dna:comp-vibe:{slug}
 *
 * @param tags - All tags from item.media.tags
 * @returns Array of comp-vibe slugs (e.g., "game-of-thrones-meets-peaky-blinders")
 */
export function parseCompVibes(tags: string[] | undefined): string[] {
  if (!tags || tags.length === 0) return [];

  return tags
    .filter(t => t.toLowerCase().startsWith('dna:comp-vibe:'))
    .map(t => {
      const parts = t.split(':');
      return parts.slice(2).join(':').trim();
    })
    .filter(Boolean);
}

/**
 * Format a comp-vibe slug for display.
 * Converts "game-of-thrones-meets-peaky-blinders" → "Game of Thrones meets Peaky Blinders"
 */
export function formatCompVibe(slug: string): string {
  return slug
    .split('-')
    .map((word, i) => {
      // Don't capitalize small words unless they're first
      const smallWords = ['of', 'the', 'a', 'an', 'and', 'in', 'on', 'at', 'to', 'for', 'with', 'meets'];
      if (i > 0 && smallWords.includes(word.toLowerCase())) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
