/**
 * src/features/browse/components/VibeCard.tsx
 *
 * Displays a comp-vibe tag as a styled card with mini cover thumbnails.
 * e.g., "Game of Thrones meets Peaky Blinders" with book count + 3 covers.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';
import { secretLibraryColors as colors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, wp } from '@/shared/theme';
import { formatCompVibe } from '@/shared/utils/bookDNA';
import { apiClient } from '@/core/api';

interface VibeCardProps {
  slug: string;
  bookCount: number;
  bookIds?: string[];
  onPress: (slug: string) => void;
}

const CARD_WIDTH = wp(100) * 0.68;
const THUMB_SIZE = scale(42);

export function VibeCard({ slug, bookCount, bookIds, onPress }: VibeCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress(slug)}
    >
      {/* Cover thumbnails at top */}
      {bookIds && bookIds.length > 0 && (
        <View style={styles.thumbsRow}>
          {bookIds.map((id, i) => (
            <Image
              key={id}
              source={{ uri: apiClient.getItemCoverUrl(id, { width: 100, height: 100 }) }}
              style={[
                styles.thumb,
                i > 0 && { marginLeft: -scale(10) },
              ]}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ))}
        </View>
      )}

      {/* Vibe name */}
      <Text style={styles.vibeText} numberOfLines={2}>
        {formatCompVibe(slug)}
      </Text>

      {/* Bottom row */}
      <View style={styles.bottomRow}>
        <Text style={styles.countText}>
          {bookCount} {bookCount === 1 ? 'book' : 'books'}
        </Text>
        <ChevronRight size={14} color={colors.gray} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    paddingHorizontal: scale(16),
    paddingVertical: scale(16),
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'space-between',
    minHeight: scale(140),
  },
  cardPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  thumbsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: scale(6),
    borderWidth: 1.5,
    borderColor: 'rgba(0, 0, 0, 0.4)',
  },
  vibeText: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(18),
    fontStyle: 'italic',
    color: '#FFFFFF',
    lineHeight: scale(24),
    marginBottom: scale(12),
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    color: colors.gray,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
