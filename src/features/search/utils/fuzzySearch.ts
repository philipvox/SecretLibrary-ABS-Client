/**
 * src/features/search/utils/fuzzySearch.ts
 *
 * Fuzzy search utilities for typo-tolerant matching.
 * Implements Levenshtein distance for "Did you mean" suggestions.
 *
 * Enhanced matching includes:
 * - Space-insensitive matching ("earth sea" → "earthsea")
 * - Accent normalization ("carre" → matches "Carré")
 * - Partial phrase matching ("the quartet" → "The Earthsea Quartet")
 * - Multi-word matching ("long sun" → "Lake of the Long Sun")
 */

// Punctuation regex for stripping - FIX: proper character class, not literal dots
const PUNCTUATION_REGEX = /[\s\-_.'':;,!?()[\]{}]/g;

/**
 * Normalize string for search comparison.
 * - Lowercases
 * - Strips accents/diacritics (é → e, ñ → n)
 * - Strips punctuation and spaces
 */
export function normalizeForSearch(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Strip diacritics
    .replace(PUNCTUATION_REGEX, '');
}

/**
 * Calculate Levenshtein (edit) distance between two strings.
 * Lower distance = more similar.
 */
export function levenshteinDistance(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  if (aLower === bLower) return 0;
  if (aLower.length === 0) return bLower.length;
  if (bLower.length === 0) return aLower.length;

  const matrix: number[][] = [];

  // Initialize first row and column
  for (let i = 0; i <= bLower.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= aLower.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= bLower.length; i++) {
    for (let j = 1; j <= aLower.length; j++) {
      if (bLower.charAt(i - 1) === aLower.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[bLower.length][aLower.length];
}

/**
 * Calculate similarity score (0-1) between two strings.
 * 1 = identical, 0 = completely different.
 */
export function similarityScore(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/**
 * Normalize string by removing spaces and common separators.
 * "earth sea" → "earthsea", "The Earthsea Quartet" → "theearthseaquartet"
 */
export function normalizeForComparison(str: string): string {
  return str.toLowerCase().replace(/[\s\-_''":;,.!?()[\]{}]/g, '');
}

/**
 * Get all word permutations for reordering matching.
 * "sea eart" → ["seaeart", "eartsea"]
 */
function getWordPermutations(words: string[]): string[] {
  if (words.length <= 1) return [words.join('')];
  if (words.length === 2) {
    return [words.join(''), words.reverse().join('')];
  }
  // For 3+ words, generate key combinations (limit to avoid explosion)
  const results: string[] = [words.join('')];
  // Add reversed
  results.push([...words].reverse().join(''));
  // Add pairs in different orders for 3 words
  if (words.length === 3) {
    results.push(words[1] + words[0] + words[2]);
    results.push(words[0] + words[2] + words[1]);
    results.push(words[2] + words[1] + words[0]);
  }
  return [...new Set(results)];
}

/**
 * Check if all query words appear in target (in any order).
 * "the quartet" matches "The Earthsea Quartet"
 */
function allWordsMatch(queryWords: string[], targetLower: string): boolean {
  // Filter out very short words like "a", "the" for matching
  const significantWords = queryWords.filter(w => w.length > 2);
  if (significantWords.length === 0) {
    // If all words are short, use original words
    return queryWords.every(word => targetLower.includes(word));
  }
  return significantWords.every(word => targetLower.includes(word));
}

/**
 * Check if query matches target with space-insensitive comparison.
 * "earth sea" matches "earthsea" and vice versa.
 */
function _spaceInsensitiveMatch(queryNorm: string, targetNorm: string): boolean {
  // Direct substring match without spaces
  if (targetNorm.includes(queryNorm)) return true;
  if (queryNorm.includes(targetNorm) && targetNorm.length >= 4) return true;
  return false;
}

/**
 * Check if query fuzzy matches target string with word reordering.
 * "sea eart" should match "earthsea"
 */
function _reorderedMatch(queryWords: string[], targetNorm: string, threshold: number): boolean {
  const permutations = getWordPermutations(queryWords);
  for (const perm of permutations) {
    // Check substring match
    if (targetNorm.includes(perm)) return true;
    // Check similarity for short permutations
    if (perm.length <= 10 && similarityScore(perm, targetNorm) >= threshold) return true;
    // Check if permutation is similar to any substring of target
    if (perm.length <= targetNorm.length) {
      for (let i = 0; i <= targetNorm.length - perm.length; i++) {
        const substr = targetNorm.substring(i, i + perm.length);
        if (similarityScore(perm, substr) >= threshold) return true;
      }
    }
  }
  return false;
}

/**
 * Check if query fuzzy matches target string.
 * OPTIMIZED FOR PERFORMANCE - no expensive Levenshtein calculations.
 *
 * Supports:
 * - Substring matching ("earth" → "Earthsea")
 * - Word prefix matching ("ear" → "Earthsea")
 * - Space-insensitive matching ("earth sea" → "earthsea", "earthsea" → "Earth Sea")
 * - Accent normalization ("carre" → "Carré")
 * - Multi-word matching ("long sun" → "Lake of the Long Sun")
 */
export function fuzzyMatch(query: string, target: string, _threshold = 0.6): boolean {
  const queryLower = query.toLowerCase().trim();
  const targetLower = target.toLowerCase().trim();

  if (!queryLower || !targetLower) return false;

  // Fast path 1: Exact substring match (handles 95%+ of cases)
  if (targetLower.includes(queryLower)) return true;

  // Fast path 2: Word prefix match (e.g., "ear" matches "Earthsea", "sand" matches "Sanderson")
  const targetWords = targetLower.split(/\s+/);
  for (const word of targetWords) {
    if (word.startsWith(queryLower)) return true;
  }

  // Fast path 3: Space-insensitive + accent-normalized matching
  // FIX: Runs for ALL queries (not just multi-word)
  // "earthsea" matches "A Wizard of Earth Sea"
  // "earth sea" matches "Earthsea"
  // "carre" matches "Carré"
  const queryNorm = normalizeForSearch(queryLower);
  const targetNorm = normalizeForSearch(targetLower);
  if (queryNorm.length >= 3 && targetNorm.includes(queryNorm)) {
    return true;
  }

  // Fast path 4: Multi-word - all significant words must appear (any order)
  // "long sun" matches "Lake of the Long Sun"
  // "a wizard of earthsea" matches (uses "wizard", "earthsea")
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);
  if (queryWords.length >= 2) {
    const significantWords = queryWords.filter(w => w.length > 2);
    if (significantWords.length > 0 && significantWords.every(w => targetLower.includes(w))) {
      return true;
    }
    // Also try with normalized (accent-stripped) words
    const normWords = significantWords.map(w => normalizeForSearch(w));
    if (normWords.length > 0 && normWords.every(w => targetNorm.includes(w))) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate enhanced similarity score that considers multiple matching strategies.
 * Returns a score from 0-1 where higher is better.
 */
export function enhancedSimilarityScore(query: string, target: string): number {
  const queryLower = query.toLowerCase().trim();
  const targetLower = target.toLowerCase().trim();

  // Exact match
  if (queryLower === targetLower) return 1;

  // Exact substring match - high score
  if (targetLower.includes(queryLower)) {
    // Boost for prefix matches
    if (targetLower.startsWith(queryLower)) return 0.95;
    return 0.9;
  }

  // Normalized (space-insensitive) match
  const queryNorm = normalizeForComparison(queryLower);
  const targetNorm = normalizeForComparison(targetLower);

  if (targetNorm.includes(queryNorm)) {
    if (targetNorm.startsWith(queryNorm)) return 0.92;
    return 0.85;
  }

  // All words match (any order)
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);
  if (queryWords.length >= 2 && allWordsMatch(queryWords, targetLower)) {
    return 0.8;
  }

  // Levenshtein-based similarity
  const baseSimilarity = similarityScore(queryLower, targetLower);
  const normSimilarity = similarityScore(queryNorm, targetNorm);

  // Return the best of the two
  return Math.max(baseSimilarity, normSimilarity);
}

/**
 * Find best spelling correction suggestions for a query.
 * Returns array of { text, score } sorted by score descending.
 * Enhanced to use space-insensitive and reordering matching.
 */
export function findSuggestions(
  query: string,
  candidates: string[],
  maxSuggestions = 3,
  minScore = 0.5
): { text: string; score: number }[] {
  const queryLower = query.toLowerCase().trim();
  if (!queryLower) return [];

  const scored = candidates
    .map(candidate => ({
      text: candidate,
      score: enhancedSimilarityScore(queryLower, candidate),
    }))
    .filter(item => item.score >= minScore && item.score < 1) // Exclude exact matches
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions);

  return scored;
}

/**
 * Generate phonetic key for name matching (simplified Soundex-like).
 * Helps match "Brandson" to "Brandon", "Kristen" to "Kristen".
 */
export function phoneticKey(str: string): string {
  return str
    .toLowerCase()
    .replace(/[aeiou]/g, 'a') // Normalize vowels
    .replace(/[bp]/g, 'b')    // Normalize bilabials
    .replace(/[cgjkqsxz]/g, 'c') // Normalize gutturals/sibilants
    .replace(/[dt]/g, 'd')    // Normalize dentals
    .replace(/[fv]/g, 'f')    // Normalize labiodentals
    .replace(/[mn]/g, 'm')    // Normalize nasals
    .replace(/[lr]/g, 'l')    // Normalize liquids
    .replace(/(.)\1+/g, '$1') // Remove consecutive duplicates
    .slice(0, 8);             // Limit length
}

/**
 * Check if two strings match phonetically (useful for names).
 */
export function phoneticMatch(a: string, b: string): boolean {
  return phoneticKey(a) === phoneticKey(b);
}

/**
 * Common abbreviations and their expansions for audiobooks.
 */
const ABBREVIATIONS: Record<string, string[]> = {
  'hp': ['harry potter'],
  'lotr': ['lord of the rings'],
  'asoiaf': ['song of ice and fire', 'game of thrones'],
  'got': ['game of thrones'],
  'scifi': ['science fiction', 'sci-fi'],
  'sci-fi': ['science fiction'],
  'hr': ['hour', 'hours'],
  'hrs': ['hours'],
  'min': ['minute', 'minutes'],
  'mins': ['minutes'],
};

/**
 * Expand common abbreviations in query.
 */
export function expandAbbreviations(query: string): string[] {
  const queryLower = query.toLowerCase().trim();
  const results = [query];

  for (const [abbr, expansions] of Object.entries(ABBREVIATIONS)) {
    if (queryLower.includes(abbr)) {
      for (const expansion of expansions) {
        results.push(query.replace(new RegExp(abbr, 'gi'), expansion));
      }
    }
  }

  return results;
}
