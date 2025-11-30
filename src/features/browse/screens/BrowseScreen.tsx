/**
 * src/features/browse/screens/BrowseScreen.tsx
 *
 * Recommendations screen with masonry grid layout
 * Uses reading preferences and history to generate personalized recommendations
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '@/core/api';
import { useLibraryCache } from '@/core/cache';
import { usePlayerStore } from '@/features/player';
import { usePreferencesStore } from '@/features/recommendations';
import { useContinueListening } from '@/features/home/hooks/useContinueListening';
import { Icon } from '@/shared/components/Icon';
import { LoadingSpinner } from '@/shared/components';
import { LibraryItem } from '@/core/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAP = 5;
const PADDING = 5;
const NUM_COLUMNS = 3;
const CARD_SIZE = (SCREEN_WIDTH - PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const CARD_RADIUS = 5;

const BG_COLOR = '#1a1a1a';
const ACCENT = '#CCFF00';

type Category = 'for_you' | 'recent' | 'unstarted' | 'short' | 'long';

interface BookItem {
  id: string;
  coverUrl: string;
  title: string;
  author: string;
  size: 1 | 2;
  score: number;
}

interface ScoredBook {
  item: LibraryItem;
  score: number;
}

// Score a book based on user preferences and history
function scoreBook(
  item: LibraryItem,
  preferences: {
    favoriteGenres: string[];
    favoriteAuthors: string[];
    favoriteNarrators: string[];
    prefersSeries: boolean | null;
    preferredLength: string;
  },
  historyAuthors: Set<string>,
  historyGenres: Set<string>,
  historyNarrators: Set<string>,
  alreadyListening: Set<string>
): number {
  let score = 0;
  const metadata = (item.media?.metadata as any) || {};
  const author = metadata.authorName || '';
  const narrator = (metadata.narratorName || '').replace(/^Narrated by\s*/i, '').trim();
  const genres: string[] = metadata.genres || [];
  const duration = item.media?.duration || 0;
  const isSeries = !!metadata.seriesName;
  const progress = item.userMediaProgress?.progress || 0;

  // Skip books already in progress (they show in continue listening)
  if (alreadyListening.has(item.id)) {
    return -1000;
  }

  // Heavily penalize finished books
  if (progress >= 0.95) {
    return -500;
  }

  // Boost unstarted books slightly
  if (progress === 0) {
    score += 5;
  }

  // Match favorite genres (high weight)
  for (const genre of genres) {
    if (preferences.favoriteGenres.some(g => genre.toLowerCase().includes(g.toLowerCase()))) {
      score += 20;
    }
    // Also boost if genre matches history
    if (historyGenres.has(genre.toLowerCase())) {
      score += 10;
    }
  }

  // Match favorite authors (high weight)
  if (preferences.favoriteAuthors.some(a => author.toLowerCase().includes(a.toLowerCase()))) {
    score += 25;
  }
  // Boost authors from history
  if (historyAuthors.has(author.toLowerCase())) {
    score += 15;
  }

  // Match favorite narrators
  if (preferences.favoriteNarrators.some(n => narrator.toLowerCase().includes(n.toLowerCase()))) {
    score += 15;
  }
  if (historyNarrators.has(narrator.toLowerCase())) {
    score += 10;
  }

  // Series preference
  if (preferences.prefersSeries === true && isSeries) {
    score += 10;
  } else if (preferences.prefersSeries === false && !isSeries) {
    score += 10;
  }

  // Length preference
  const hours = duration / 3600;
  if (preferences.preferredLength === 'short' && hours < 8) {
    score += 10;
  } else if (preferences.preferredLength === 'medium' && hours >= 8 && hours <= 20) {
    score += 10;
  } else if (preferences.preferredLength === 'long' && hours > 20) {
    score += 10;
  }

  // Add some randomness to avoid same order every time
  score += Math.random() * 5;

  return score;
}

// Masonry layout computation
function computeMasonryLayout(items: BookItem[]): Array<{ item: BookItem; x: number; y: number; w: number; h: number }> {
  const positions: Array<{ item: BookItem; x: number; y: number; w: number; h: number }> = [];
  const grid: boolean[][] = [];

  const getCell = (row: number, col: number) => grid[row]?.[col] || false;
  const setCell = (row: number, col: number, val: boolean) => {
    if (!grid[row]) grid[row] = [];
    grid[row][col] = val;
  };

  let maxRow = 0;

  items.forEach((item) => {
    const cells = item.size;
    let placed = false;

    for (let row = 0; row <= maxRow + 1 && !placed; row++) {
      for (let col = 0; col <= NUM_COLUMNS - cells && !placed; col++) {
        let canPlace = true;
        for (let dr = 0; dr < cells && canPlace; dr++) {
          for (let dc = 0; dc < cells && canPlace; dc++) {
            if (getCell(row + dr, col + dc)) canPlace = false;
          }
        }

        if (canPlace) {
          for (let dr = 0; dr < cells; dr++) {
            for (let dc = 0; dc < cells; dc++) {
              setCell(row + dr, col + dc, true);
            }
          }

          const w = cells * CARD_SIZE + (cells - 1) * GAP;
          const h = cells * CARD_SIZE + (cells - 1) * GAP;

          positions.push({
            item,
            x: PADDING + col * (CARD_SIZE + GAP),
            y: row * (CARD_SIZE + GAP),
            w,
            h,
          });

          maxRow = Math.max(maxRow, row + cells - 1);
          placed = true;
        }
      }
    }
  });

  return positions;
}

export function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { loadBook } = usePlayerStore();
  const [activeCategory, setActiveCategory] = useState<Category>('for_you');

  // Get user preferences
  const {
    favoriteGenres,
    favoriteAuthors,
    favoriteNarrators,
    prefersSeries,
    preferredLength,
  } = usePreferencesStore();

  // Get continue listening for history context
  const { items: continueItems } = useContinueListening();

  // Use library cache (already loaded on app startup)
  const { items: libraryItems, isLoaded, isLoading } = useLibraryCache();

  // Extract history context from continue listening
  const historyContext = useMemo(() => {
    const authors = new Set<string>();
    const genres = new Set<string>();
    const narrators = new Set<string>();
    const listeningIds = new Set<string>();

    for (const item of continueItems) {
      listeningIds.add(item.id);
      const metadata = (item.media?.metadata as any) || {};
      if (metadata.authorName) authors.add(metadata.authorName.toLowerCase());
      if (metadata.narratorName) {
        const narrator = metadata.narratorName.replace(/^Narrated by\s*/i, '').trim();
        if (narrator) narrators.add(narrator.toLowerCase());
      }
      for (const genre of (metadata.genres || [])) {
        genres.add(genre.toLowerCase());
      }
    }

    return { authors, genres, narrators, listeningIds };
  }, [continueItems]);

  // Score and sort all items based on preferences
  const scoredItems = useMemo(() => {
    if (!isLoaded || !libraryItems.length) return [];
    const preferences = { favoriteGenres, favoriteAuthors, favoriteNarrators, prefersSeries, preferredLength };

    const scored: ScoredBook[] = libraryItems.map((item: LibraryItem) => ({
      item,
      score: scoreBook(
        item,
        preferences,
        historyContext.authors,
        historyContext.genres,
        historyContext.narrators,
        historyContext.listeningIds
      ),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored;
  }, [libraryItems, isLoaded, favoriteGenres, favoriteAuthors, favoriteNarrators, prefersSeries, preferredLength, historyContext]);

  // Filter based on category
  const filteredItems = useMemo(() => {
    let items = scoredItems.filter(s => s.score > -100); // Exclude very negative scores

    switch (activeCategory) {
      case 'for_you':
        // Top recommendations (already sorted by score)
        break;
      case 'recent':
        // Sort by added date (newest first)
        items = [...items].sort((a, b) => (b.item.addedAt || 0) - (a.item.addedAt || 0));
        break;
      case 'unstarted':
        // Only unstarted books
        items = items.filter(s => (s.item.userMediaProgress?.progress || 0) === 0);
        break;
      case 'short':
        // Books under 8 hours
        items = items.filter(s => {
          const hours = (s.item.media?.duration || 0) / 3600;
          return hours > 0 && hours < 8;
        });
        break;
      case 'long':
        // Books over 15 hours
        items = items.filter(s => {
          const hours = (s.item.media?.duration || 0) / 3600;
          return hours > 15;
        });
        break;
    }

    return items.slice(0, 40);
  }, [scoredItems, activeCategory]);

  // Process items for masonry grid
  const processedItems = useMemo(() => {
    return filteredItems.map((scored, idx) => ({
      id: scored.item.id,
      coverUrl: apiClient.getItemCoverUrl(scored.item.id),
      title: (scored.item.media?.metadata as any)?.title || 'Unknown',
      author: (scored.item.media?.metadata as any)?.authorName || 'Unknown',
      // Top scored items get large cards
      size: (idx < 3 && scored.score > 30) || idx % 7 === 0 ? 2 : 1,
      score: scored.score,
    })) as BookItem[];
  }, [filteredItems]);

  // Compute masonry layout
  const layout = useMemo(() => computeMasonryLayout(processedItems), [processedItems]);
  const gridHeight = useMemo(() => {
    if (layout.length === 0) return 0;
    return Math.max(...layout.map(p => p.y + p.h)) + GAP;
  }, [layout]);

  // Handle book press - open player without autoplay
  const handleBookPress = useCallback(async (bookId: string) => {
    try {
      const fullBook = await apiClient.getItem(bookId);
      await loadBook(fullBook, { autoPlay: false });
    } catch (err) {
      console.error('Failed to open book:', err);
    }
  }, [loadBook]);

  const categories: { key: Category; label: string; count?: number }[] = [
    { key: 'for_you', label: 'For You', count: filteredItems.length },
    { key: 'recent', label: 'Recent' },
    { key: 'unstarted', label: 'New' },
    { key: 'short', label: 'Quick Listens' },
    { key: 'long', label: 'Epic' },
  ];

  if (isLoading || !isLoaded) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />
        <LoadingSpinner text="Loading recommendations..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Just for You</Text>
            <Text style={styles.headerSubtitle}>
              Based on your preferences & listening history
            </Text>
          </View>
          <TouchableOpacity
            style={styles.preferencesButton}
            onPress={() => navigation.navigate('Preferences')}
          >
            <Icon name="options-outline" size={22} color={ACCENT} set="ionicons" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 80 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {processedItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="library-outline" size={48} color="rgba(255,255,255,0.3)" set="ionicons" />
            <Text style={styles.emptyTitle}>No recommendations yet</Text>
            <Text style={styles.emptySubtitle}>
              Start listening to some books and we'll personalize your recommendations
            </Text>
          </View>
        ) : (
          <View style={[styles.grid, { height: gridHeight }]}>
            {layout.map(({ item, x, y, w, h }) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, { left: x, top: y, width: w, height: h }]}
                onPress={() => handleBookPress(item.id)}
                activeOpacity={0.85}
              >
                <Image
                  source={item.coverUrl}
                  style={styles.cardImage}
                  contentFit="cover"
                  transition={200}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom category tabs */}
      <View style={[styles.bottomTabs, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="chevron-back" size={24} color="#FFFFFF" set="ionicons" />
        </TouchableOpacity>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.tab, activeCategory === cat.key && styles.tabActive]}
              onPress={() => setActiveCategory(cat.key)}
            >
              <Text style={[styles.tabText, activeCategory === cat.key && styles.tabTextActive]}>
                {cat.label}
              </Text>
              {cat.count !== undefined && activeCategory === cat.key && (
                <Text style={styles.tabCount}>{cat.count}</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  header: {
    paddingHorizontal: PADDING + 10,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
  preferencesButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(204, 255, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 0,
  },
  grid: {
    width: SCREEN_WIDTH,
    position: 'relative',
  },
  card: {
    position: 'absolute',
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#2a2a2a',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
  },
  bottomTabs: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BG_COLOR,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  tabsContent: {
    paddingRight: 20,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginLeft: 6,
  },
});
