/**
 * src/shared/components/MasonryGrid.tsx
 *
 * Masonry grid layout component with varying card sizes
 */

import React, { useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GAP = 5;
const PADDING = 5;
const NUM_COLUMNS = 3;
const CARD_SIZE = (SCREEN_WIDTH - PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const CARD_RADIUS = 5;

interface MasonryItem {
  id: string;
  coverUrl: string;
  // Size: 1 = small (1x1), 2 = large (2x2)
  size?: 1 | 2;
}

interface MasonryGridProps {
  items: MasonryItem[];
  onItemPress: (id: string) => void;
  ListHeaderComponent?: React.ReactElement;
}

// Simple masonry layout algorithm
function computeLayout(items: MasonryItem[]): Array<{ item: MasonryItem; x: number; y: number; w: number; h: number }> {
  const positions: Array<{ item: MasonryItem; x: number; y: number; w: number; h: number }> = [];

  // Track which cells are occupied
  const grid: boolean[][] = [];
  const getCell = (row: number, col: number) => grid[row]?.[col] || false;
  const setCell = (row: number, col: number, val: boolean) => {
    if (!grid[row]) grid[row] = [];
    grid[row][col] = val;
  };

  let maxRow = 0;

  items.forEach((item) => {
    const size = item.size || 1;
    const cells = size; // 1x1 or 2x2

    // Find first available position
    let placed = false;
    for (let row = 0; row <= maxRow + 1 && !placed; row++) {
      for (let col = 0; col <= NUM_COLUMNS - cells && !placed; col++) {
        // Check if all required cells are free
        let canPlace = true;
        for (let dr = 0; dr < cells && canPlace; dr++) {
          for (let dc = 0; dc < cells && canPlace; dc++) {
            if (getCell(row + dr, col + dc)) canPlace = false;
          }
        }

        if (canPlace) {
          // Place item
          for (let dr = 0; dr < cells; dr++) {
            for (let dc = 0; dc < cells; dc++) {
              setCell(row + dr, col + dc, true);
            }
          }

          positions.push({
            item,
            x: PADDING + col * (CARD_SIZE + GAP),
            y: row * (CARD_SIZE + GAP),
            w: cells * CARD_SIZE + (cells - 1) * GAP,
            h: cells * CARD_SIZE + (cells - 1) * GAP,
          });

          maxRow = Math.max(maxRow, row + cells - 1);
          placed = true;
        }
      }
    }
  });

  return positions;
}

export function MasonryGrid({ items, onItemPress, ListHeaderComponent }: MasonryGridProps) {
  const layout = useMemo(() => computeLayout(items), [items]);

  const contentHeight = useMemo(() => {
    if (layout.length === 0) return 0;
    return Math.max(...layout.map(p => p.y + p.h)) + GAP;
  }, [layout]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
      showsVerticalScrollIndicator={false}
    >
      {ListHeaderComponent}

      <View style={[styles.grid, { height: contentHeight }]}>
        {layout.map(({ item, x, y, w, h }) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.card,
              {
                position: 'absolute',
                left: x,
                top: y,
                width: w,
                height: h,
              },
            ]}
            onPress={() => onItemPress(item.id)}
            activeOpacity={0.8}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: GAP,
  },
  grid: {
    width: SCREEN_WIDTH,
    position: 'relative',
  },
  card: {
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#2a2a2a',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
});

export { CARD_SIZE, GAP, PADDING, NUM_COLUMNS };
