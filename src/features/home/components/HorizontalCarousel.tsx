/**
 * src/features/home/components/HorizontalCarousel.tsx
 *
 * Performant horizontal scrolling carousel using FlatList
 */

import React, { useCallback } from 'react';
import { View, FlatList, StyleSheet, ListRenderItem } from 'react-native';
import { layout, spacing } from '@/shared/theme';
import { HorizontalCarouselProps } from '../types';

const DIMENSIONS = { carouselItemGap: spacing.md };
const LAYOUT = { carouselPaddingHorizontal: layout.screenPaddingH };

export function HorizontalCarousel<T>({
  data,
  renderItem,
  keyExtractor,
  itemWidth,
  gap = DIMENSIONS.carouselItemGap,
  contentPadding = LAYOUT.carouselPaddingHorizontal,
  showsScrollIndicator = false,
  snapToItem = false,
  onEndReached,
  onEndReachedThreshold = 0.5,
}: HorizontalCarouselProps<T>) {
  const renderListItem: ListRenderItem<T> = useCallback(
    ({ item, index }) => (
      <View style={[styles.itemContainer, { width: itemWidth, marginRight: gap }]}>
        {renderItem(item, index)}
      </View>
    ),
    [renderItem, itemWidth, gap]
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: itemWidth + gap,
      offset: (itemWidth + gap) * index,
      index,
    }),
    [itemWidth, gap]
  );

  return (
    <FlatList
      horizontal
      data={data}
      renderItem={renderListItem}
      keyExtractor={keyExtractor}
      showsHorizontalScrollIndicator={showsScrollIndicator}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingHorizontal: contentPadding },
      ]}
      snapToInterval={snapToItem ? itemWidth + gap : undefined}
      decelerationRate={snapToItem ? 'fast' : 'normal'}
      onEndReached={onEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      getItemLayout={getItemLayout}
      initialNumToRender={5}
      maxToRenderPerBatch={5}
      windowSize={5}
      removeClippedSubviews
    />
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingVertical: 4, // Small padding for shadow overflow
  },
  itemContainer: {
    // Container for each item
  },
});
