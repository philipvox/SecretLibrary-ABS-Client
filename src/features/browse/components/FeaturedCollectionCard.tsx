/**
 * src/features/browse/components/FeaturedCollectionCard.tsx
 *
 * Full-width featured collection card with cover mosaic,
 * collection name, and book count. Used at top of Collections tab.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { BookOpen } from 'lucide-react-native';
import { Collection } from '@/core/types';
import { apiClient } from '@/core/api';
import { scale, radius } from '@/shared/theme';
import { secretLibraryColors as colors, secretLibraryFonts } from '@/shared/theme/secretLibrary';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = 24;
const CARD_WIDTH = SCREEN_WIDTH - CARD_PADDING * 2;
const MOSAIC_HEIGHT = scale(180);

interface FeaturedCollectionCardProps {
  collection: Collection;
  onPress: () => void;
}

export function FeaturedCollectionCard({ collection, onPress }: FeaturedCollectionCardProps) {
  const books = collection.books || [];
  const bookCount = books.length;

  // Get cover URLs for mosaic (up to 4)
  const coverUrls = useMemo(() => {
    return books.slice(0, 4).map((book) =>
      apiClient.getItemCoverUrl(book.id, { width: 300, height: 300 })
    );
  }, [books]);

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={onPress}
    >
      {/* Cover Mosaic */}
      <View style={styles.mosaic}>
        {coverUrls.length >= 4 ? (
          // 2x2 grid
          <View style={styles.mosaicGrid}>
            {coverUrls.map((url, i) => (
              <Image
                key={i}
                source={{ uri: url }}
                style={styles.mosaicQuarter}
                contentFit="cover"
                transition={200}
              />
            ))}
          </View>
        ) : coverUrls.length >= 2 ? (
          // Side by side
          <View style={styles.mosaicRow}>
            {coverUrls.slice(0, 3).map((url, i) => (
              <Image
                key={i}
                source={{ uri: url }}
                style={styles.mosaicThird}
                contentFit="cover"
                transition={200}
              />
            ))}
          </View>
        ) : coverUrls.length === 1 ? (
          <Image
            source={{ uri: coverUrls[0] }}
            style={styles.mosaicFull}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.mosaicPlaceholder} />
        )}
      </View>

      {/* Info row */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{collection.name}</Text>
        <View style={styles.countRow}>
          <BookOpen size={scale(12)} color={colors.gray} strokeWidth={2} />
          <Text style={styles.countText}>{bookCount} {bookCount === 1 ? 'book' : 'books'}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: CARD_PADDING,
    marginBottom: scale(16),
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pressed: {
    opacity: 0.85,
  },
  mosaic: {
    width: CARD_WIDTH,
    height: MOSAIC_HEIGHT,
    overflow: 'hidden',
  },
  mosaicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    height: '100%',
  },
  mosaicQuarter: {
    width: '50%',
    height: '50%',
  },
  mosaicRow: {
    flexDirection: 'row',
    width: '100%',
    height: '100%',
  },
  mosaicThird: {
    flex: 1,
    height: '100%',
  },
  mosaicFull: {
    width: '100%',
    height: '100%',
  },
  mosaicPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#262626',
  },
  info: {
    padding: scale(14),
  },
  name: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(20),
    color: colors.white,
    marginBottom: scale(4),
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  countText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    color: colors.gray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
