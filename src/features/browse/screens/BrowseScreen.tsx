/**
 * src/features/browse/screens/BrowseScreen.tsx
 *
 * Redesigned Discover/Browse screen with masonry grid layout
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
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/core/api';
import { usePlayerStore } from '@/features/player';
import { Icon } from '@/shared/components/Icon';
import { LoadingSpinner } from '@/shared/components';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAP = 5;
const PADDING = 5;
const NUM_COLUMNS = 3;
const CARD_SIZE = (SCREEN_WIDTH - PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const LARGE_CARD_SIZE = CARD_SIZE * 2 + GAP;
const CARD_RADIUS = 5;

const BG_COLOR = '#1a1a1a';
const ACCENT = '#CCFF00';

type Category = 'featured' | 'recent' | 'popular' | 'series' | 'authors';

interface BookItem {
  id: string;
  coverUrl: string;
  title: string;
  author: string;
  size: 1 | 2;
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
  const [activeCategory, setActiveCategory] = useState<Category>('featured');

  // Fetch library items
  const { data: libraryData, isLoading } = useQuery({
    queryKey: ['library-items-browse'],
    queryFn: () => apiClient.getLibraryItems(),
    staleTime: 5 * 60 * 1000,
  });

  // Process items for masonry grid with varying sizes
  const processedItems = useMemo(() => {
    const items = libraryData?.results || [];
    return items.slice(0, 30).map((item: any, idx: number) => ({
      id: item.id,
      coverUrl: apiClient.getItemCoverUrl(item.id),
      title: item.media?.metadata?.title || 'Unknown',
      author: item.media?.metadata?.authorName || 'Unknown',
      // Make some items large (2x2) for visual interest
      size: (idx % 5 === 0 || idx % 7 === 0) ? 2 : 1,
    })) as BookItem[];
  }, [libraryData]);

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
    { key: 'featured', label: 'Featured', count: processedItems.length },
    { key: 'recent', label: 'Recent' },
    { key: 'popular', label: 'Popular' },
    { key: 'series', label: 'Series' },
    { key: 'authors', label: 'Authors' },
  ];

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />
        <LoadingSpinner text="Loading..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />

      {/* Main content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 10, paddingBottom: 80 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Masonry grid */}
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
              {/* Optional: Heart button for favorites */}
              <TouchableOpacity style={styles.heartButton}>
                <Icon name="heart-outline" size={16} color="rgba(255,255,255,0.8)" set="ionicons" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
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

      {/* FAB for add */}
      <TouchableOpacity style={[styles.fab, { bottom: 80 + insets.bottom }]}>
        <Icon name="add" size={28} color="#000000" set="ionicons" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
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
  heartButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
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
  fab: {
    position: 'absolute',
    left: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
