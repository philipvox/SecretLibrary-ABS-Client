/**
 * src/features/browse/hooks/useRecentlyCompletedSeries.ts
 *
 * Finds the most recently completed series and returns DNA-matched
 * recommendations for the "Because You Finished [Series]" section.
 *
 * Matching priority:
 *   1. BookDNA — mood scores, spectrums, tropes, themes, pacing (high confidence)
 *   2. Genre overlap — requires 2+ specific genre matches (fallback)
 *
 * Derives series from filteredItems (not seriesMap) so kids series
 * are naturally excluded when audience is 'all'.
 */

import { useMemo } from 'react';
import { useProgressStore } from '@/core/stores/progressStore';
import { LibraryItem, BookMetadata, BookMedia } from '@/core/types';
import { parseBookDNA, BookDNA, getDNAQuality, SPECTRUM_KEYS } from '@/shared/utils/bookDNA';
import { useDNASettingsStore } from '@/shared/stores/dnaSettingsStore';

function getMetadata(item: LibraryItem): BookMetadata | Record<string, never> {
  if (item.mediaType !== 'book' || !item.media?.metadata) return {};
  return item.media.metadata as BookMetadata;
}

function getTags(item: LibraryItem): string[] {
  if (item.mediaType !== 'book') return [];
  return (item.media as BookMedia)?.tags || [];
}

function getSeriesName(item: LibraryItem): string | null {
  const metadata = getMetadata(item) as BookMetadata | undefined;
  const name = metadata?.seriesName?.replace(/\s*#[\d.]+$/, '')
    || metadata?.series?.[0]?.name;
  return name || null;
}

// Genres too broad to be meaningful for matching
const BROAD_GENRES = new Set([
  'fiction', 'nonfiction', 'non-fiction', 'novel', 'literature',
  'audiobook', 'audiobooks', 'audio', 'book', 'books',
  'adult', 'new adult',
]);

// ─── DNA Matching ────────────────────────────────────────────────────────────

/**
 * Build a quality-weighted averaged DNA profile from multiple books.
 * Books with richer DNA contribute more, preserving signal from well-tagged books
 * rather than diluting it with sparse ones.
 *
 * Weight by DNA quality:
 *   EXCELLENT (15+ tags): 3x weight
 *   GOOD (8–14 tags):     2x weight
 *   MINIMAL (<8 tags):    1x weight
 *   No DNA:               0 weight (skipped for DNA averaging, can still contribute to genre fallback)
 */
function buildSeriesDNAProfile(books: LibraryItem[]): BookDNA | null {
  const dnas = books.map((b) => parseBookDNA(getTags(b))).filter((d) => d.hasDNA);
  if (dnas.length === 0) return null;

  // Assign quality weight per DNA profile
  const weighted = dnas.map((d) => {
    const quality = getDNAQuality(d);
    const weight = quality === 'excellent' ? 3 : quality === 'good' ? 2 : 1;
    return { dna: d, weight };
  });

  // Weighted average spectrum values
  const avgSpectrum = (key: keyof BookDNA['spectrums']) => {
    let sum = 0;
    let w = 0;
    for (const { dna, weight } of weighted) {
      const val = dna.spectrums[key];
      if (val !== null) { sum += val * weight; w += weight; }
    }
    return w > 0 ? sum / w : null;
  };

  // Collect all unique mood keys and compute weighted average for each
  const allMoodKeys = new Set<string>();
  for (const d of dnas) {
    for (const key of Object.keys(d.moodScores)) allMoodKeys.add(key);
  }
  const avgMoods: Record<string, number> = {};
  for (const key of allMoodKeys) {
    let sum = 0;
    let w = 0;
    for (const { dna, weight } of weighted) {
      const val = dna.moodScores[key];
      if (val !== undefined) { sum += val * weight; w += weight; }
    }
    if (w > 0) avgMoods[key] = sum / w;
  }

  // Collect all tropes/themes (union)
  const allTropes = new Set<string>();
  const allThemes = new Set<string>();
  const allSettings = new Set<string>();
  for (const d of dnas) {
    d.tropes.forEach((t) => allTropes.add(t));
    d.themes.forEach((t) => allThemes.add(t));
    d.settings.forEach((t) => allSettings.add(t));
  }

  // Weighted pacing vote
  const pacingVotes = new Map<string, number>();
  for (const { dna, weight } of weighted) {
    if (dna.pacing) pacingVotes.set(dna.pacing, (pacingVotes.get(dna.pacing) || 0) + weight);
  }
  let topPacing: BookDNA['pacing'] = null;
  let topPacingVote = 0;
  pacingVotes.forEach((vote, pacing) => {
    if (vote > topPacingVote) { topPacing = pacing as BookDNA['pacing']; topPacingVote = vote; }
  });

  return {
    length: null,
    pacing: topPacing,
    structure: null,
    pov: null,
    seriesPosition: null,
    pubEra: null,
    spectrums: {
      darkLight: avgSpectrum('darkLight'),
      seriousFunny: avgSpectrum('seriousFunny'),
      plotCharacter: avgSpectrum('plotCharacter'),
      simpleComplex: avgSpectrum('simpleComplex'),
      actionContemplative: avgSpectrum('actionContemplative'),
      intimateEpicScope: avgSpectrum('intimateEpicScope'),
      worldDensity: avgSpectrum('worldDensity'),
    },
    tropes: Array.from(allTropes),
    themes: Array.from(allThemes),
    settings: Array.from(allSettings),
    narratorStyle: null,
    production: null,
    moodScores: avgMoods,
    comparableTitles: [],
    vibe: null,
    hasDNA: true,
    tagCount: weighted.reduce((sum, w) => sum + w.dna.tagCount, 0),
  };
}

/**
 * Score how similar a book's DNA is to a series DNA profile (0-1).
 *
 * Uses FIXED maxScore (100) so missing dimensions penalize rather than
 * being excluded. Without this, a book with no mood overlap but similar
 * spectrums would score ~0.85 instead of ~0.25.
 */
function scoreDNASimilarity(bookDNA: BookDNA, seriesProfile: BookDNA): number {
  let score = 0;
  const maxScore = 100;

  // Mood similarity (40 points) — dynamic mood keys
  // If series has moods but book shares none, score stays 0/40
  const seriesMoodKeys = Object.keys(seriesProfile.moodScores);
  if (seriesMoodKeys.length > 0) {
    const sharedMoodKeys = seriesMoodKeys
      .filter((k) => bookDNA.moodScores[k] !== undefined);

    if (sharedMoodKeys.length >= 2) {
      let moodSim = 0;
      for (const key of sharedMoodKeys) {
        const diff = Math.abs(seriesProfile.moodScores[key] - bookDNA.moodScores[key]);
        moodSim += 1 - diff;
      }
      score += (moodSim / sharedMoodKeys.length) * 40;
    }
    // else: 0 points — no shared moods is a strong negative signal
  }

  // Spectrum similarity (25 points) — 7 spectrums
  let spectrumScore = 0;
  let spectrumCount = 0;
  for (const key of SPECTRUM_KEYS) {
    const seriesVal = seriesProfile.spectrums[key];
    const bookVal = bookDNA.spectrums[key];
    if (seriesVal !== null && bookVal !== null) {
      const diff = Math.abs(seriesVal - bookVal) / 2; // range is 2
      spectrumScore += 1 - diff;
      spectrumCount++;
    }
  }
  if (spectrumCount > 0) {
    score += (spectrumScore / spectrumCount) * 25;
  }

  // Shared tropes (15 points)
  if (seriesProfile.tropes.length > 0) {
    if (bookDNA.tropes.length > 0) {
      const shared = bookDNA.tropes.filter((t) => seriesProfile.tropes.includes(t)).length;
      score += (shared / seriesProfile.tropes.length) * 15;
    }
    // else: 0 points — series has tropes, book doesn't
  }

  // Shared themes (15 points)
  if (seriesProfile.themes.length > 0) {
    if (bookDNA.themes.length > 0) {
      const shared = bookDNA.themes.filter((t) => seriesProfile.themes.includes(t)).length;
      score += (shared / seriesProfile.themes.length) * 15;
    }
    // else: 0 points — series has themes, book doesn't
  }

  // Pacing match (5 points)
  if (seriesProfile.pacing && bookDNA.pacing) {
    score += seriesProfile.pacing === bookDNA.pacing ? 5 : 0;
  }

  return score / maxScore;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface CompletedSeriesResult {
  seriesName: string;
  genreTags: string[];
  matchingBooks: LibraryItem[];
}

export function useRecentlyCompletedSeries(
  items: LibraryItem[]
): CompletedSeriesResult | null {
  const progressMap = useProgressStore((s) => s.progressMap);
  const dnaEnabled = useDNASettingsStore((s) => s.enableDNAFeatures);

  return useMemo(() => {
    if (!items.length || progressMap.size === 0) return null;

    // Group books by series (derived from filteredItems, so kids already excluded)
    const seriesBooks = new Map<string, LibraryItem[]>();
    for (const item of items) {
      if (item.mediaType !== 'book') continue;
      const series = getSeriesName(item);
      if (!series) continue;
      const existing = seriesBooks.get(series) || [];
      existing.push(item);
      seriesBooks.set(series, existing);
    }

    // Find series where we've finished at least 2 books
    const seriesWithFinished: {
      name: string;
      finishedCount: number;
      latestFinish: number;
      genres: string[];
      books: LibraryItem[];
      bookIds: Set<string>;
    }[] = [];

    seriesBooks.forEach((books, seriesName) => {
      if (books.length < 2) return;

      let finishedCount = 0;
      let latestFinish = 0;
      const genreSet = new Set<string>();

      for (const book of books) {
        const progress = progressMap.get(book.id);
        if (progress?.isFinished || (progress?.progress ?? 0) >= 0.95) {
          finishedCount++;
          if (progress?.lastPlayedAt && progress.lastPlayedAt > latestFinish) {
            latestFinish = progress.lastPlayedAt;
          }
        }
        const metadata = getMetadata(book);
        if (metadata.genres) {
          for (const g of metadata.genres) {
            const lower = g.toLowerCase();
            if (!BROAD_GENRES.has(lower)) genreSet.add(lower);
          }
        }
      }

      if (finishedCount >= 2) {
        seriesWithFinished.push({
          name: seriesName,
          finishedCount,
          latestFinish,
          genres: Array.from(genreSet),
          books,
          bookIds: new Set(books.map((b) => b.id)),
        });
      }
    });

    if (seriesWithFinished.length === 0) return null;

    seriesWithFinished.sort((a, b) => b.latestFinish - a.latestFinish);
    const topSeries = seriesWithFinished[0];

    // Try DNA-based matching first (skip when DNA features disabled)
    const seriesDNAProfile = dnaEnabled ? buildSeriesDNAProfile(topSeries.books) : null;

    // Build series index: for each series, map sequence# → bookId
    // Used to check if user can start a mid-series book
    const seriesIndex = new Map<string, Map<number, string>>();
    for (const item of items) {
      if (item.mediaType !== 'book') continue;
      const metadata = getMetadata(item);
      const seriesList = (metadata as BookMetadata)?.series;
      if (!seriesList) continue;
      for (const s of seriesList) {
        if (!s.name || !s.sequence) continue;
        const seq = parseFloat(s.sequence);
        if (isNaN(seq)) continue;
        if (!seriesIndex.has(s.name)) seriesIndex.set(s.name, new Map());
        seriesIndex.get(s.name)!.set(seq, item.id);
      }
    }

    /** Check if a book is safe to recommend (not mid-series without prereqs read) */
    function isSeriesEntryPoint(item: LibraryItem): boolean {
      const metadata = getMetadata(item);
      const seriesList = (metadata as BookMetadata)?.series;
      if (!seriesList || seriesList.length === 0) return true; // Not in a series — fine

      // Check each series the book belongs to
      for (const s of seriesList) {
        if (!s.sequence) continue; // No sequence info — allow it
        const seq = parseFloat(s.sequence);
        if (isNaN(seq) || seq <= 1) continue; // Book 1 or no valid sequence — fine

        // Mid-series book: check that user has read all preceding books
        const seriesMap = seriesIndex.get(s.name);
        if (!seriesMap) continue;

        // Find all sequence numbers less than this book's
        for (const [prevSeq, prevBookId] of seriesMap) {
          if (prevSeq >= seq) continue;
          const prevProgress = progressMap.get(prevBookId);
          if (!prevProgress || (prevProgress.progress < 0.05 && !prevProgress.isFinished)) {
            return false; // Haven't read a preceding book — skip
          }
        }
      }

      return true;
    }

    // Score all candidate books
    const scored: { item: LibraryItem; score: number }[] = [];

    for (const item of items) {
      if (item.mediaType !== 'book') continue;
      if (topSeries.bookIds.has(item.id)) continue;

      // Skip books user has already read
      const progress = progressMap.get(item.id);
      if (progress && (progress.progress > 0.05 || progress.isFinished)) continue;

      // Skip mid-series books unless user has read preceding entries
      if (!isSeriesEntryPoint(item)) continue;

      // Genre check (used as gate for DNA and as fallback)
      const metadata = getMetadata(item);
      const genres = (metadata.genres || []).map((g: string) => g.toLowerCase());
      const genreMatchCount = topSeries.genres.filter((g) => genres.includes(g)).length;

      let score = 0;

      if (seriesDNAProfile) {
        const bookDNA = parseBookDNA(getTags(item));
        if (bookDNA.hasDNA && genreMatchCount >= 1) {
          // DNA matching gated by at least 1 shared genre
          const rawScore = scoreDNASimilarity(bookDNA, seriesDNAProfile);
          score = rawScore >= 0.3 ? rawScore : 0;
        } else if (genreMatchCount >= 2) {
          // No DNA or no genre overlap — fall back to genre-only with lower weight
          score = 0.2 + (genreMatchCount * 0.05);
        }
      } else {
        // No series DNA — pure genre matching (require 2+)
        score = genreMatchCount >= 2 ? 0.3 + (genreMatchCount * 0.1) : 0;
      }

      if (score > 0) {
        scored.push({ item, score });
      }
    }

    // Sort by score descending, take top 15
    scored.sort((a, b) => b.score - a.score);
    const matchingBooks = scored.slice(0, 15).map((s) => s.item);

    if (matchingBooks.length < 3) return null;

    const displayGenres = topSeries.genres.slice(0, 3).map(
      (g) => g.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    );

    return {
      seriesName: topSeries.name,
      genreTags: displayGenres,
      matchingBooks,
    };
  }, [items, progressMap, dnaEnabled]);
}
