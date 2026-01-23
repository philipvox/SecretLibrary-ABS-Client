/**
 * src/features/browse/components/CollectionThumb.tsx
 *
 * Numbered book thumbnail for collection rows.
 * Shows cover image with numbered label above.
 * Uses spine cache for consistent hash-based coloring.
 */

import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { secretLibraryColors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { apiClient } from '@/core/api';
import { scale } from '@/shared/theme';
import { useSpineCacheStore } from '@/features/home/stores/spineCache';
// MIGRATED: Now using new spine system via adapter
import { SPINE_COLOR_PALETTE } from '@/features/home/utils/spine/adapter';

interface CollectionThumbProps {
  bookId: string;
  bookTitle?: string;
  index: number; // 0-based index
  onPress?: () => void;
}

function CollectionThumbComponent({
  bookId,
  bookTitle,
  index,
  onPress,
}: CollectionThumbProps) {
  const number = String(index + 1).padStart(2, '0');
  const coverUrl = apiClient.getItemCoverUrl(bookId, { width: 400, height: 400 });

  // Get cached data for consistent hash
  const getSpineData = useSpineCacheStore((state) => state.getSpineData);

  // Generate initials and color from cache or fallback
  const { initials, fallbackColor } = useMemo(() => {
    const cached = getSpineData(bookId);

    // Use cached title if available, otherwise use provided title
    const title = cached?.title || bookTitle || '';
    const initialsValue = title
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('');

    // Use cached hash if available, otherwise calculate
    const hash = cached?.hash ?? bookId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colorIndex = hash % SPINE_COLOR_PALETTE.length;

    return {
      initials: initialsValue,
      fallbackColor: SPINE_COLOR_PALETTE[colorIndex],
    };
  }, [bookId, bookTitle, getSpineData]);

  return (
    <Pressable style={styles.container} onPress={onPress}>
      {/* Number label */}
      <Text style={styles.number}>{number}</Text>

      {/* Thumbnail */}
      <View style={[styles.thumbContainer, { backgroundColor: fallbackColor }]}>
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <Text style={styles.initials}>{initials}</Text>
        )}
      </View>
    </Pressable>
  );
}

export const CollectionThumb = memo(CollectionThumbComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 60,
  },
  number: {
    fontFamily: secretLibraryFonts.playfair.regularItalic,
    fontSize: scale(11),
    fontStyle: 'italic',
    color: secretLibraryColors.gray,
    marginBottom: 6,
  },
  thumbContainer: {
    width: '100%',
    aspectRatio: 3 / 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  initials: {
    fontSize: scale(14),
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.12)',
  },
});
