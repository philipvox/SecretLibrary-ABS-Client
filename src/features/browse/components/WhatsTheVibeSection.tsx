/**
 * src/features/browse/components/WhatsTheVibeSection.tsx
 *
 * "What's The Vibe" section — curated horizontal carousel of comp-vibe cards.
 * Automatically selects quality vibes based on parameters:
 * - Must be "X meets Y" format (contains "meets")
 * - Must have enough matching books (minimum threshold)
 * - Shows a rotating selection per session
 */

import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { secretLibraryColors as colors } from '@/shared/theme/secretLibrary';
import { scale } from '@/shared/theme';
import { parseCompVibes } from '@/shared/utils/bookDNA';
import { SectionHeader } from './SectionHeader';
import { LibraryItem } from '@/core/types';
import { VibeCard } from './VibeCard';

interface WhatsTheVibeSectionProps {
  items: LibraryItem[];
  onVibePress: (slug: string) => void;
}

// Quality thresholds
const MIN_BOOKS_PER_VIBE = 5;  // Need at least 5 books to show
const DISPLAY_COUNT = 6;        // Show 6 vibes at a time
const MAX_THUMBS = 3;           // Up to 3 cover thumbnails per card

// Quality filters — what makes a "good" vibe
function isQualityVibe(slug: string): boolean {
  // Must contain "meets" (the "X meets Y" format)
  if (!slug.includes('meets')) return false;

  // Must have at least 2 parts around "meets"
  const parts = slug.split('-meets-');
  if (parts.length !== 2) return false;

  // Both sides should have substance (at least 2 words / segments)
  const left = parts[0].split('-');
  const right = parts[1].split('-');
  if (left.length < 2 || right.length < 2) return false;

  return true;
}

// Session-stable shuffle (changes each app launch)
const SESSION_SEED = Date.now();
function seededShuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  let seed = SESSION_SEED;
  for (let i = result.length - 1; i > 0; i--) {
    seed = (seed * 16807 + 0) % 2147483647;
    const j = seed % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function WhatsTheVibeSection({ items, onVibePress }: WhatsTheVibeSectionProps) {
  const vibeData = useMemo(() => {
    const vibeCounts = new Map<string, number>();
    const vibeBookIds = new Map<string, string[]>();

    for (const item of items) {
      const tags = (item.media?.metadata as any)?.tags || (item.media as any)?.tags;
      const vibes = parseCompVibes(tags);
      for (const vibe of vibes) {
        // Only track quality vibes
        if (!isQualityVibe(vibe)) continue;

        vibeCounts.set(vibe, (vibeCounts.get(vibe) || 0) + 1);
        const ids = vibeBookIds.get(vibe) || [];
        if (ids.length < MAX_THUMBS) {
          ids.push(item.id);
        }
        vibeBookIds.set(vibe, ids);
      }
    }

    // Filter by minimum book count, sort by count, take top candidates, shuffle, pick display count
    const qualified = Array.from(vibeCounts.entries())
      .filter(([, count]) => count >= MIN_BOOKS_PER_VIBE)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20) // Pool of top 20 qualified vibes
      .map(([slug, count]) => ({
        slug,
        count,
        bookIds: vibeBookIds.get(slug) || [],
      }));

    return seededShuffle(qualified).slice(0, DISPLAY_COUNT);
  }, [items]);

  const handleVibePress = useCallback((slug: string) => {
    onVibePress(slug);
  }, [onVibePress]);

  if (vibeData.length === 0) return null;

  return (
    <View style={styles.container}>
      <SectionHeader label="What's the Vibe" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {vibeData.map(({ slug, count, bookIds }) => (
          <VibeCard
            key={slug}
            slug={slug}
            bookCount={count}
            bookIds={bookIds}
            onPress={handleVibePress}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.black,
    paddingBottom: scale(20),
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: scale(12),
  },
});
