/**
 * src/features/library/screens/MyLibraryScreen.tsx
 *
 * User's library with masonry grid layout
 * Redesigned to match app aesthetic
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMyLibraryStore } from '../stores/myLibraryStore';
import { useAllLibraryItems } from '@/features/search/hooks/useAllLibraryItems';
import { useDefaultLibrary } from '../hooks/useDefaultLibrary';
import { usePlayerStore } from '@/features/player';
import { apiClient } from '@/core/api';
import { Icon } from '@/shared/components/Icon';
import { LoadingSpinner, EmptyState } from '@/shared/components';
import { LibraryItem } from '@/core/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAP = 5;
const PADDING = 5;
const NUM_COLUMNS = 3;
const CARD_SIZE = (SCREEN_WIDTH - PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const CARD_RADIUS = 5;
const BG_COLOR = '#1a1a1a';
const ACCENT = '#CCFF00';

interface BookGridItem {
  id: string;
  coverUrl: string;
  size: 1 | 2;
}

// Masonry layout computation
function computeMasonryLayout(items: BookGridItem[]): Array<{ item: BookGridItem; x: number; y: number; w: number; h: number }> {
  const positions: Array<{ item: BookGridItem; x: number; y: number; w: number; h: number }> = [];
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

export function MyLibraryScreen() {
  const insets = useSafeAreaInsets();
  const { library } = useDefaultLibrary();
  const { items: allItems, isLoading } = useAllLibraryItems(library?.id || '');
  const { loadBook } = usePlayerStore();

  const {
    libraryIds,
    isSelecting,
    selectedIds,
    toggleSelection,
    startSelecting,
    stopSelecting,
    selectAll,
    clearSelection,
    removeMultiple,
  } = useMyLibraryStore();

  // Filter to only show books in user's library
  const libraryItems = useMemo(() => {
    return allItems.filter(item => libraryIds.includes(item.id));
  }, [allItems, libraryIds]);

  // Process items for masonry grid
  const processedItems = useMemo(() => {
    return libraryItems.map((item, idx) => ({
      id: item.id,
      coverUrl: apiClient.getItemCoverUrl(item.id),
      // Make some items large for visual interest
      size: (idx % 5 === 0 || idx % 8 === 0) ? 2 : 1,
    })) as BookGridItem[];
  }, [libraryItems]);

  // Compute masonry layout
  const layout = useMemo(() => computeMasonryLayout(processedItems), [processedItems]);
  const gridHeight = useMemo(() => {
    if (layout.length === 0) return 0;
    return Math.max(...layout.map(p => p.y + p.h)) + GAP;
  }, [layout]);

  const handleSelectAll = () => {
    if (selectedIds.length === libraryItems.length) {
      clearSelection();
    } else {
      selectAll(libraryItems.map(item => item.id));
    }
  };

  const handleRemove = () => {
    if (selectedIds.length === 0) return;

    Alert.alert(
      'Remove from Library',
      `Remove ${selectedIds.length} ${selectedIds.length === 1 ? 'book' : 'books'} from your library?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeMultiple(selectedIds),
        },
      ]
    );
  };

  const handleCancel = () => {
    stopSelecting();
  };

  const handleBookPress = useCallback(async (bookId: string) => {
    if (isSelecting) {
      toggleSelection(bookId);
      return;
    }

    try {
      const fullBook = await apiClient.getItem(bookId);
      await loadBook(fullBook, { autoPlay: false });
    } catch (err) {
      console.error('Failed to open book:', err);
    }
  }, [isSelecting, toggleSelection, loadBook]);

  const handleBookLongPress = useCallback((bookId: string) => {
    if (!isSelecting) {
      startSelecting();
      toggleSelection(bookId);
    }
  }, [isSelecting, startSelecting, toggleSelection]);

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />
        <LoadingSpinner text="Loading library..." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />

      {/* Selection Header */}
      {isSelecting && (
        <View style={[styles.selectionHeader, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <Text style={styles.selectionCount}>
            {selectedIds.length} selected
          </Text>

          <View style={styles.selectionActions}>
            <TouchableOpacity onPress={handleSelectAll} style={styles.headerButton}>
              <Text style={styles.selectAllText}>
                {selectedIds.length === libraryItems.length ? 'None' : 'All'}
              </Text>
            </TouchableOpacity>

            {selectedIds.length > 0 && (
              <TouchableOpacity onPress={handleRemove} style={styles.headerButton}>
                <Icon name="trash-outline" size={22} color="#FF4444" set="ionicons" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {libraryItems.length === 0 ? (
        <View style={[styles.emptyContainer, { paddingTop: insets.top }]}>
          <EmptyState
            message="Your library is empty"
            description="Add books from Discover to build your collection"
            icon="📚"
          />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: isSelecting ? 10 : insets.top + 10, paddingBottom: 100 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          {!isSelecting && (
            <View style={styles.headerSection}>
              <Text style={styles.headerTitle}>Your Library</Text>
              <Text style={styles.headerSubtitle}>
                {libraryItems.length} {libraryItems.length === 1 ? 'book' : 'books'}
              </Text>
            </View>
          )}

          {/* Masonry Grid */}
          <View style={[styles.grid, { height: gridHeight }]}>
            {layout.map(({ item, x, y, w, h }) => {
              const isSelected = selectedIds.includes(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.card,
                    { left: x, top: y, width: w, height: h },
                    isSelected && styles.cardSelected,
                  ]}
                  onPress={() => handleBookPress(item.id)}
                  onLongPress={() => handleBookLongPress(item.id)}
                  activeOpacity={0.85}
                  delayLongPress={300}
                >
                  <Image
                    source={item.coverUrl}
                    style={styles.cardImage}
                    contentFit="cover"
                    transition={200}
                  />
                  {isSelecting && (
                    <View style={[styles.selectionOverlay, isSelected && styles.selectionOverlayActive]}>
                      {isSelected && (
                        <View style={styles.checkmark}>
                          <Icon name="checkmark" size={16} color="#000" set="ionicons" />
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
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
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: BG_COLOR,
  },
  headerButton: {
    padding: 8,
  },
  cancelText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllText: {
    fontSize: 16,
    color: ACCENT,
  },
  headerSection: {
    paddingHorizontal: PADDING + 5,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
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
  cardSelected: {
    borderWidth: 3,
    borderColor: ACCENT,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  selectionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionOverlayActive: {
    backgroundColor: 'rgba(204,255,0,0.2)',
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MyLibraryScreen;
