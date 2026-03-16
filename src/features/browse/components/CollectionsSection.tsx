/**
 * src/features/browse/components/CollectionsSection.tsx
 *
 * Collections section for browse page with square cards.
 * Shows collections with cover images, book counts, and white names.
 */

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { secretLibraryColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { Collection } from '@/core/types';
import { CollectionSquareCard } from './CollectionSquareCard';
import { scale, useSecretLibraryColors } from '@/shared/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const HORIZONTAL_PADDING = 16;
const CARD_SIZE = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - CARD_GAP) / 2;

interface CollectionsSectionProps {
  /** Collections data passed from parent */
  collections: Collection[];
  /** Called when a collection card is pressed */
  onCollectionPress?: (collectionId: string) => void;
  /** Called when View All is pressed */
  onViewAll?: () => void;
  /** Maximum number of collections to display */
  maxCollections?: number;
  /** Skip the first collection (shown separately as featured) */
  skipFirst?: boolean;
}

export function CollectionsSection({
  collections,
  onCollectionPress,
  onViewAll,
  maxCollections = 4,
  skipFirst = false,
}: CollectionsSectionProps) {
  // Theme-aware colors (used for header)
  const _colors = useSecretLibraryColors();

  const handleCollectionPress = useCallback(
    (collectionId: string) => {
      onCollectionPress?.(collectionId);
    },
    [onCollectionPress]
  );

  // Don't render if no collections
  if (!collections || collections.length === 0) {
    return null;
  }

  // Optionally skip first (shown as featured card), then limit
  const startIndex = skipFirst ? 1 : 0;
  const displayCollections = collections.slice(startIndex, startIndex + maxCollections);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Collections</Text>
        <Pressable onPress={onViewAll}>
          <Text style={styles.link}>VIEW ALL</Text>
        </Pressable>
      </View>

      {/* Horizontal scroll of collection cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {displayCollections.map((collection) => (
          <View key={collection.id} style={styles.cardWrapper}>
            <CollectionSquareCard
              collection={collection}
              size={CARD_SIZE}
              onPress={() => handleCollectionPress(collection.id)}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: secretLibraryColors.black,
    paddingVertical: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(4),
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  title: {
    fontFamily: secretLibraryFonts.jetbrainsMono.medium,
    fontSize: scale(11),
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: secretLibraryColors.white,
  },
  link: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    textDecorationLine: 'underline',
    color: secretLibraryColors.white,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    gap: CARD_GAP,
  },
  cardWrapper: {
    // Individual card wrapper
  },
});
